// tistory.publish — 마크다운 글을 티스토리에 발행.
// POST /manage/post.json (application/json + 세션 쿠키). content는 HTML이어야 하므로 marked로 변환.
import type { WindforceContext } from "windforce-client";
import { buildCookieHeader, tistoryHeaders, visibilityCode } from "../lib/tistory";
import { markdownToTistoryHtml } from "../lib/markdown";

interface PublishInput {
  blog?: string;                 // 블로그 식별자(예: "pak2251"). 없으면 변수 tistory/blog
  title: string;
  contentMarkdown: string;       // 본문 마크다운(HTML로 변환되어 전송)
  category?: number;             // 카테고리 ID(미지정=0=카테고리 없음). 이름→ID는 category/simple.json 참고
  tag?: string[];
  visibility?: string;           // "public" | "protected" | "private" (기본 private — 안전)
  slug?: string;                 // 글 주소(slogan). 미지정 시 제목 사용
}

export async function publish(ctx: WindforceContext) {
  const input = ctx.input as PublishInput;
  if (!input || !input.title || !input.contentMarkdown) {
    throw new Error("title, contentMarkdown은 필수입니다.");
  }
  const blog = input.blog || (await ctx.variables.get("tistory/blog"));
  const cookieHeader = buildCookieHeader(await ctx.variables.get("tistory/storage_state"));
  const content = markdownToTistoryHtml(input.contentMarkdown);
  const visibility = visibilityCode(input.visibility); // 기본 0=비공개

  const body = {
    id: "0",                                  // 0 = 새 글
    title: input.title,
    content,                                  // HTML
    slogan: input.slug || input.title,
    visibility,
    category: input.category ?? 0,
    tag: (input.tag || []).join(","),
    published: 1,                             // 1 = 발행(0=임시저장)
    uselessMarginForEntry: 1,
    cclCommercial: 0,
    cclDerive: 0,
    type: "post",
    attachments: [],
    recaptchaValue: "",
    draftSequence: null,
  };

  const url = `https://${blog}.tistory.com/manage/post.json`;
  const res = await ctx.http.fetch(url, {
    method: "POST",
    headers: { ...tistoryHeaders(blog, cookieHeader, "manage/newpost"), "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`post.json 실패: ${res.status} ${text.slice(0, 300)} (세션 만료면 storage_state 재추출)`);
  }
  let response: any = text;
  try { response = JSON.parse(text); } catch { /* 응답이 JSON이 아닐 수 있음 */ }
  // post.json 응답은 { entryUrl: "https://.../entry/<slug>" } 형태(실측).
  const entryUrl: string | undefined =
    response && typeof response === "object" ? response.entryUrl : undefined;

  ctx.logger.info(`발행: "${input.title}" visibility=${input.visibility || "private"} -> ${entryUrl || "(url 없음)"}`);
  await ctx.state.set({ lastTitle: input.title, lastVisibility: input.visibility || "private", entryUrl });

  return { ok: true, blog, title: input.title, visibility: input.visibility || "private", entryUrl, response };
}
