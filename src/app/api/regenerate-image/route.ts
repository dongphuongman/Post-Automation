import { sql } from '@/lib/db';
import { generateImageResponse } from '@/lib/ai/image-generator';
import { ok, fail } from '@/lib/api-response';
import { getSession } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

// Tạo LẠI ảnh AI cho một bài đã tồn tại (retry). generateImageResponse chỉ chạy một
// lần lúc viết bài (/api/write); nếu lúc đó proxy ảnh tắt / lỗi → generated_image_url
// = null và bài kẹt vĩnh viễn. Endpoint này cho phép tạo lại từ UI. Owner-scoped.
export async function POST(req: Request) {
  try {
    const s = getSession(req);
    if (!s) return fail('Chưa đăng nhập', 401);
    if (!rateLimit(`regen-image:${s.uid}`, 10, 60_000)) {
      return fail('Quá nhiều yêu cầu tạo ảnh. Vui lòng đợi một chút.', 429);
    }
    const { postId } = await req.json();
    if (!postId) return fail('Thiếu postId', 400);

    // Chỉ chủ bài mới được tạo lại ảnh. Lấy tiêu đề bài gốc làm topic cho ảnh.
    const [post] = await sql`
      SELECT p.owner_id, p.content, a.title
      FROM posts p LEFT JOIN articles a ON a.id = p.article_id
      WHERE p.id = ${postId}
    `;
    if (!post) return fail('Không tìm thấy bài', 404);
    if (post.owner_id && post.owner_id !== s.uid) return fail('Không có quyền với bài này', 403);

    const topic = (post.title || String(post.content || '').split('\n')[0] || '').slice(0, 200);
    const generatedImage = await generateImageResponse(topic);
    if (!generatedImage) {
      // null = AI không trả ảnh (proxy ảnh tắt, sai IMAGE_* config, hoặc model lỗi).
      return fail('AI không tạo được ảnh — kiểm tra proxy/cấu hình IMAGE_* trong Cài đặt rồi thử lại.', 502);
    }

    await sql`UPDATE posts SET generated_image_url = ${generatedImage} WHERE id = ${postId}`;
    return ok({ generated_image_url: generatedImage });
  } catch (error) {
    return fail(String(error));
  }
}
