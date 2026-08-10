import { sql } from '@/lib/db';
import { postToFacebook } from '@/lib/facebook/poster';
import { ok, fail } from '@/lib/api-response';
import { MIN_SCHEDULE_AHEAD_MINUTES } from '@/lib/constants';
import { decrypt } from '@/lib/crypto';
import { getSession } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const s = getSession(req);
    if (!s) return fail('Chưa đăng nhập', 401);
    const { postId, imageType, scheduledTime, overrideContent, overrideHashtags, postTarget = 'page', createVideo = false, targetPageId, targetGroupIds } = await req.json();
    const [post] = await sql`SELECT * FROM posts WHERE id = ${postId}`;
    if (!post) return fail('Post not found', 404);
    if (s.role !== 'admin' && post.owner_id !== s.uid) return fail('Không có quyền', 403);

    const imgUrl = imageType === 'generated' ? post.generated_image_url : post.original_image_url;
    const finalContent = overrideContent ?? post.content;
    const finalHashtags = overrideHashtags ?? post.hashtags;
    const groupIdsJson = Array.isArray(targetGroupIds) && targetGroupIds.length ? JSON.stringify(targetGroupIds) : null;

    if (scheduledTime) {
      const nowEpoch = Math.floor(Date.now() / 1000);
      if (scheduledTime < nowEpoch + MIN_SCHEDULE_AHEAD_MINUTES * 60) {
        return fail(`Thời gian hẹn đăng phải cách hiện tại ít nhất ${MIN_SCHEDULE_AHEAD_MINUTES} phút theo quy định của Facebook.`, 400);
      }
    }

    // Lưu nội dung + ĐÍCH ĐĂNG (Page + nhóm) để bot biết đăng vào đâu.
    await sql`UPDATE posts SET content = ${finalContent}, hashtags = ${finalHashtags}, create_video = ${createVideo}, video_status = ${createVideo ? 'pending' : 'none'}, selected_image_url = ${imgUrl}, target_page_id = ${targetPageId || null}, target_group_ids = ${groupIdsJson} WHERE id = ${postId}`;

    const results: any = {};

    // Đăng Page qua BOT Playwright (dùng cookie, không cần token): đánh dấu hàng đợi
    if (postTarget === 'page') {
      const ts = scheduledTime || null;
      await sql`UPDATE posts SET status = 'ready_for_page', scheduled_time = ${ts} WHERE id = ${postId}`;
      results.page = { success: true, message: 'Da danh dau cho Bot dang Page' };
    }

    // Đăng lên TƯỜNG CÁ NHÂN của chính user qua BOT Playwright (cookie riêng của user).
    if (postTarget === 'profile') {
      const ts = scheduledTime || null;
      await sql`UPDATE posts SET status = 'ready_for_profile', scheduled_time = ${ts} WHERE id = ${postId}`;
      results.profile = { success: true, message: 'Da danh dau cho Bot dang trang ca nhan' };
    }

    // Đăng lên X qua BOT (cookie riêng của user, mở phiên ẩn) — đánh dấu hàng đợi.
    if (postTarget === 'x') {
      const ts = scheduledTime || null;
      await sql`UPDATE posts SET status = 'ready_for_x', scheduled_time = ${ts} WHERE id = ${postId}`;
      results.x = { success: true, message: 'Da danh dau cho Bot dang X' };
    }

    // Đăng lên Threads qua API chính thức (bot dùng access token của user).
    if (postTarget === 'threads') {
      const ts = scheduledTime || null;
      await sql`UPDATE posts SET status = 'ready_for_threads', scheduled_time = ${ts} WHERE id = ${postId}`;
      results.threads = { success: true, message: 'Da danh dau cho Bot dang Threads' };
    }

    // Đăng lên Instagram qua BOT (cookie riêng, mở phiên ẩn — bắt buộc có ảnh).
    if (postTarget === 'instagram') {
      const ts = scheduledTime || null;
      await sql`UPDATE posts SET status = 'ready_for_instagram', scheduled_time = ${ts} WHERE id = ${postId}`;
      results.instagram = { success: true, message: 'Da danh dau cho Bot dang Instagram' };
    }

    // Target 'all' vẫn dùng Graph API cho Page (dùng token của Page đích nếu có)
    if (postTarget === 'all') {
      let creds: { pageGraphId: string; token: string } | undefined;
      if (targetPageId) {
        const [pg] = await sql`SELECT page_id, access_token_enc FROM facebook_pages WHERE id = ${targetPageId}`;
        if (pg?.page_id && pg?.access_token_enc) {
          try { creds = { pageGraphId: pg.page_id, token: decrypt(pg.access_token_enc) }; } catch { /* rơi về env */ }
        }
      }
      const fbRes = await postToFacebook(finalContent, finalHashtags, imgUrl, scheduledTime, creds);
      if (fbRes.id) {
        results.page = { success: true, id: fbRes.post_id || fbRes.id };
        await sql`UPDATE posts SET status = 'posted', facebook_post_id = ${fbRes.post_id || fbRes.id} WHERE id = ${postId}`;
      } else {
        results.page = { success: false, error: fbRes.error?.message || 'FB API Error' };
      }
    }

    if (postTarget === 'groups' || postTarget === 'all') {
      const ts = scheduledTime || null;
      await sql`UPDATE posts SET status = 'ready_for_groups', scheduled_time = ${ts} WHERE id = ${postId}`;
      results.groups = [{ success: true, message: 'Da danh dau cho Bot xu ly' }];
    }

    if (postTarget === 'reels') {
      const ts = scheduledTime || null;
      await sql`UPDATE posts SET create_video = true, video_status = 'pending', status = 'posted', scheduled_time = ${ts} WHERE id = ${postId}`;
      results.reels = { success: true, message: 'Da gui lenh tao Video Reel cho Bot' };
    }

    const pageOk = !results.page || results.page.success;
    if (!pageOk && postTarget === 'page') {
      return fail(results.page?.error || 'FB API Error', 400);
    }

    return ok({ results });
  } catch (error) {
    return fail(String(error));
  }
}
