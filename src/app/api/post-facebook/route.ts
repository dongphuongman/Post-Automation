import { sql } from '@/lib/db';
import { postToFacebook } from '@/lib/facebook/poster';
import { ok, fail } from '@/lib/api-response';
import { MIN_SCHEDULE_AHEAD_MINUTES } from '@/lib/constants';

export async function POST(req: Request) {
  try {
    const { postId, imageType, scheduledTime, overrideContent, overrideHashtags, postTarget = 'page', createVideo = false } = await req.json();
    const [post] = await sql`SELECT * FROM posts WHERE id = ${postId}`;
    if (!post) return fail('Post not found', 404);

    const imgUrl = imageType === 'generated' ? post.generated_image_url : post.original_image_url;
    const finalContent = overrideContent ?? post.content;
    const finalHashtags = overrideHashtags ?? post.hashtags;

    if (scheduledTime) {
      const nowEpoch = Math.floor(Date.now() / 1000);
      if (scheduledTime < nowEpoch + MIN_SCHEDULE_AHEAD_MINUTES * 60) {
        return fail(`Thời gian hẹn đăng phải cách hiện tại ít nhất ${MIN_SCHEDULE_AHEAD_MINUTES} phút theo quy định của Facebook.`, 400);
      }
    }

    await sql`UPDATE posts SET content = ${finalContent}, hashtags = ${finalHashtags}, create_video = ${createVideo}, video_status = ${createVideo ? 'pending' : 'none'}, selected_image_url = ${imgUrl} WHERE id = ${postId}`;

    const results: any = {};

    if (postTarget === 'page' || postTarget === 'all') {
      const fbRes = await postToFacebook(finalContent, finalHashtags, imgUrl, scheduledTime);
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
