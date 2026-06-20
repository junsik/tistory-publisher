// tistory.list — 발행된 글 목록 조회.
// 티스토리 관리 페이지의 /manage/posts.json을 페이지네이션으로 전부 수집해
// blogs 번호↔파일 매핑의 정본(postId)을 돌려준다.
import type { WindforceContext } from "windforce-client";
import { buildCookieHeader, tistoryHeaders, visibilityLabel } from "../lib/tistory";

interface ListInput {
  blog?: string;                 // 블로그 식별자(예: "pak2251"). 없으면 변수 tistory/blog
  visibility?: string;           // "all" | "public" | "private" | "protected" (기본 all)
  maxPages?: number;             // 안전 상한(기본 200)
}

interface RawItem {
  id: string; title: string; slogan: string; visibility: string;
  category: string | null; categoryId: string | null;
  published: string; created: string; modified: string;
  permalink: string; countOfComments: string;
}

export async function list(ctx: WindforceContext) {
  const input = (ctx.input || {}) as ListInput;
  const blog = input.blog || (await ctx.variables.get("tistory/blog"));
  const cookieHeader = buildCookieHeader(await ctx.variables.get("tistory/storage_state"));
  const visFilter = input.visibility || "all";
  const maxPages = input.maxPages ?? 200;
  const headers = tistoryHeaders(blog, cookieHeader, "manage/posts/");

  const items: RawItem[] = [];
  let page = 1;
  let totalCount = Infinity;
  while (items.length < totalCount && page <= maxPages) {
    const url =
      `https://${blog}.tistory.com/manage/posts.json` +
      `?category=-3&page=${page}&searchKeyword=&searchType=title&visibility=${encodeURIComponent(visFilter)}`;
    const res = await ctx.http.fetch(url, { headers });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`posts.json 실패: ${res.status} ${body.slice(0, 200)} (세션 만료면 storage_state 재추출)`);
    }
    const data = (await res.json()) as { totalCount: number; count: number; items: RawItem[] };
    totalCount = data.totalCount ?? 0;
    if (!data.items || data.items.length === 0) break;
    items.push(...data.items);
    ctx.logger.info(`posts.json page ${page}: +${data.items.length} (누적 ${items.length}/${totalCount})`);
    page++;
  }

  const posts = items.map((it) => ({
    id: it.id,                                   // 티스토리 postId = 블로그 번호
    title: it.title,
    slug: it.slogan,
    visibility: visibilityLabel(it.visibility),
    category: it.category,
    categoryId: it.categoryId,
    published: it.published,
    modified: it.modified,
    permalink: it.permalink,                     // /entry/... 형태 정식 주소
    url: `https://${blog}.tistory.com/${it.id}`, // 번호 기반 단축 주소
    comments: Number(it.countOfComments || 0),
  }));

  return { blog, totalCount, count: posts.length, posts };
}
