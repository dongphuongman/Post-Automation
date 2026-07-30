import { FACEBOOK_API_VERSION } from '@/lib/constants';

export async function postToFacebook(
  content: string,
  hashtags: string,
  imageUrl: string | null,
  scheduledTime?: number,
) {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const token = process.env.FACEBOOK_ACCESS_TOKEN;
  if (!pageId || !token) throw new Error('Missing FB credentials');

  const message = `${content}\n\n${hashtags}`;

  if (imageUrl) {
    const form = new FormData();
    form.append('access_token', token);
    form.append('published', 'false');
    appendImage(form, imageUrl);

    const photoRes = await fetch(
      `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${pageId}/photos`,
      { method: 'POST', body: form },
    );
    const photoData = await photoRes.json();

    if (!photoData.id) {
      console.error('FB Photo Upload failed:', photoData);
      return postTextOnly(message, token, pageId, scheduledTime);
    }

    const feedPayload: any = {
      message,
      access_token: token,
      attached_media: [{ media_fbid: photoData.id }],
    };

    if (scheduledTime) {
      feedPayload.published = false;
      feedPayload.scheduled_publish_time = scheduledTime;
    }

    const res = await fetch(
      `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${pageId}/feed`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedPayload),
      },
    );
    return res.json();
  }

  return postTextOnly(message, token, pageId, scheduledTime);
}

function appendImage(form: FormData, imageUrl: string) {
  if (imageUrl.startsWith('data:')) {
    const [meta, base64data] = imageUrl.split(',');
    const mimeType = meta.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
    const buffer = Buffer.from(base64data, 'base64');
    const blob = new Blob([buffer], { type: mimeType });
    form.append('source', blob, 'image.jpg');
  } else {
    form.append('url', imageUrl);
  }
}

async function postTextOnly(message: string, token: string, pageId: string, scheduledTime?: number) {
  const payload: any = { message, access_token: token };
  if (scheduledTime) {
    payload.published = false;
    payload.scheduled_publish_time = scheduledTime;
  }

  const res = await fetch(
    `https://graph.facebook.com/${FACEBOOK_API_VERSION}/${pageId}/feed`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  return res.json();
}
