import { z } from "zod";
import { JSDOM } from "jsdom";
import DOMPurify from "dompurify";

export const FxtwitterResult = z.object({
  code: z.number(),
  message: z.string(),
  tweet: z.object({
    url: z.string(),
    text: z.string(),
    created_at: z.string(),
    created_timestamp: z.number(),
    author: z.object({
      name: z.string(),
      screen_name: z.string(),
      avatar_url: z.string(),
      avatar_color: z.string().nullable(),
      banner_url: z.string(),
    }),
    replies: z.number(),
    retweets: z.number(),
    likes: z.number(),
    views: z.number(),
    color: z.string().nullable(),
    twitter_card: z.string().optional(),
    lang: z.string(),
    source: z.string(),
    replying_to: z.any(),
    replying_to_status: z.any(),
    quote: z
      .object({
        text: z.string(),
        author: z.object({
          name: z.string(),
          screen_name: z.string(),
        }),
      })
      .optional(),
    media: z
      .object({
        all: z
          .array(
            z.object({
              type: z.enum(["video", "gif", "photo"]),
              url: z.string(),
              thumbnail_url: z.string().optional(),
              width: z.number(),
              height: z.number(),
              duration: z.number().optional(),
              format: z.string().optional(),
            })
          )
          .optional(),
        external: z
          .object({
            type: z.literal("video"),
            url: z.string(),
            height: z.number(),
            width: z.number(),
            duration: z.number(),
          })
          .optional(),
        photos: z
          .array(
            z.object({
              type: z.literal("photo"),
              url: z.string(),
              width: z.number(),
              height: z.number(),
            })
          )
          .optional(),
        videos: z
          .array(
            z.object({
              type: z.enum(["video", "gif"]),
              url: z.string(),
              thumbnail_url: z.string(),
              width: z.number(),
              height: z.number(),
              duration: z.number(),
              format: z.string(),
            })
          )
          .optional(),
        mosaic: z
          .object({
            type: z.literal("mosaic_photo"),
            width: z.number().optional(),
            height: z.number().optional(),
            formats: z.object({
              webp: z.string(),
              jpeg: z.string(),
            }),
          })
          .optional(),
      })
      .optional(),
  }),
});

export async function askFxtwitter(
  screenName: string,
  id: string,
  translateTo?: string
) {
  const url = `https://api.fxtwitter.com/${screenName}/status/${id}/${translateTo}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "defuddly (https://nulo.lol)",
    },
  });
  const json = await response.json();
  console.debug("fxtwitter res", JSON.stringify(json));
  if (response.status !== 200) {
    throw new Error(`Fxtwitter returned status ${response.status}`);
  }
  return FxtwitterResult.parse(json);
}

export async function renderFxtwitter(url: string) {
  const pathParts = url.split("/");
  const statusIndex = pathParts.indexOf("status");
  if (statusIndex !== -1 && statusIndex + 1 < pathParts.length) {
    const screenName = pathParts[1];
    const tweetId = pathParts[statusIndex + 1];

    const result = await askFxtwitter(screenName, tweetId);

    const escapeHTML = (str: string) =>
      str.replace(
        /[&<>"']/g,
        (tag) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          }[tag] || "")
      );

    const Purify = DOMPurify(new JSDOM().window);

    const escapedUrl = escapeHTML(result.tweet.url);
    const cleanTweetText = Purify.sanitize(result.tweet.text);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FXTwitter Tweet</title>
    <style>
        body, html {
            height: 100%;
            margin: 0;
            overflow: hidden;
        }
        iframe {
            width: 100%;
            height: 100%;
            border: 0;
        }
    </style>
</head>
<body>
    <div style="font-family: system-ui, sans-serif; padding: 2rem;">
        <h2>${Purify.sanitize(result.tweet.author.name)} (@${Purify.sanitize(
      result.tweet.author.screen_name
    )})</h2>
        <p>${cleanTweetText}</p>
        ${
          result.tweet.media?.videos
            ? `<video controls width="100%"><source src="${result.tweet.media.videos[0].url}" type="video/mp4"></video>`
            : result.tweet.media?.photos
            ? result.tweet.media.photos
                .map(
                  (photo) =>
                    `<img src="${photo.url}" alt="Tweet Image" style="max-width: 100%;"/>`
                )
                .join("")
            : ""
        }
        <a href="${escapedUrl}" target="_blank" data-no-proxy>View on Twitter</a>
    </div>
</body>
</html>`;
  } else {
    throw new Error("Invalid URL");
  }
}
