# tistory-publisher

마크다운 글을 **티스토리에 발행**하고, **발행된 글 목록을 조회**하는 windforce 액션 앱.

## 배경

티스토리 공식 Open API는 2024년 2월 종료됐다(글·댓글·첨부 모두). 이 앱은 관리 페이지가 내부적으로 쓰는 비공식 엔드포인트를 **세션 쿠키로 직접 호출**한다. CSRF 토큰은 없고 `origin`/`referer` + 세션 쿠키로 인증된다(실측 확인). **본인 블로그에 본인 글을 발행하는 용도**로 한정한다.

## 문서

- [docs/tistory-internal-api.md](./docs/tistory-internal-api.md) — 역공학한 티스토리 **비공식 API 계약** (엔드포인트·페이로드·visibility·필수 쿠키·응답, 깨질 때 재캡처 기준)
- [docs/auth-and-secrets.md](./docs/auth-and-secrets.md) — **세션 쿠키 + 시크릿 암호화 흐름** (변수 등록·DEK 암호화·복호화 사용·신뢰 경계·`isSecret` 함정)

## 액션

### `tistory.publish` — 글 발행
- `POST https://{blog}.tistory.com/manage/post.json` (`application/json` + 세션 쿠키)
- 본문 마크다운을 `marked`로 HTML 변환해 `content`로 전송(티스토리 에디터도 전송 직전 HTML로 바꿔 보낸다).
- 입력: `title`, `contentMarkdown`(필수), `blog?`, `category?`(ID), `tag?`, `visibility?`(`public`/`protected`/`private`, **기본 private**), `slug?`.

### `tistory.list` — 발행 글 목록
- `GET https://{blog}.tistory.com/manage/posts.json` 를 페이지네이션으로 전부 수집.
- 출력: `posts[{ id, title, slug, visibility, category, published, permalink, url, comments }]` + `totalCount`.
- `id`가 곧 **티스토리 postId = 블로그 번호**다. blogs 레포의 번호↔파일 매핑을 이 정본으로 동기화·검증할 수 있다.

발행 페이로드 `visibility` 코드(실측): **20=public, 15=protected, 0=private**. 목록 응답 라벨은 `PUBLIC`/`PRIVATE`/`PROTECTED`.

## 인증 — 세션 쿠키 (로컬 1회)

카카오 로그인은 봇 자동화를 차단하므로, **사람이 1회 로그인**해 세션 쿠키를 추출한 뒤 windforce 변수에 저장한다. 액션은 그 쿠키만 재사용한다.

1. playwright가 있는 환경에서(예: windforce `frontend/`, 또는 임시로 `bun add -d playwright@1.60.0`) **node로** 실행:
   ```
   node scripts/capture-session.mjs ./state.json
   ```
   (Windows에서 bun은 Chromium CDP launch가 hang하므로 **반드시 node**.)
2. 뜬 창에서 카카오 로그인 → 창을 닫으면 `state.json` 생성.
3. windforce 변수 등록:
   - `tistory/storage_state` = `state.json` 파일 내용 전체 (**`isSecret: true`** — DEK 암호화 저장)
   - `tistory/blog` = 블로그 식별자 (예: `pak2251`)
4. 세션 만료 시 1~3 반복.

> ⚠️ 변수 등록 JSON 필드는 **`isSecret`(camelCase)** 다. `is_secret`(snake)로 보내면 핸들러가 무시해 **평문 저장**되니 주의(세션 쿠키는 반드시 암호화돼야 함).

> 필요한 쿠키는 `TSSESSION`·`__T_`·`__T_SECURE`·`IS_TC`·`_T_ANO`(tistory.com 도메인). `buildCookieHeader`가 storage_state에서 자동 추출한다.

## dev-stack 로컬 검증

windforce dev-stack(`bun run dev-stack`; API `:28080`, ws `ws-alpha`, `ui-alpha-admin@example.com`/`correct-password`) 기준:

```sh
# 0) bare repo 준비
git -C .. clone --bare tistory-publisher tistory-publisher.git

# 1) git source 등록 → 2) sync
#    POST /api/w/ws-alpha/git_sources { name, repo_url:"file:///.../tistory-publisher.git", branch:"main" }
#    POST /api/w/ws-alpha/git_sources/{id}/sync   → actions: ["tistory.publish","tistory.list"]

# 3) 변수 등록
#    POST /api/w/ws-alpha/variables { path:"tistory/blog", value:"pak2251" }
#    POST /api/w/ws-alpha/variables { path:"tistory/storage_state", value:<state.json>, isSecret:true }

# 4) 목록 조회(부작용 없음 — 먼저 이걸로 인증 검증)
#    POST /api/w/ws-alpha/jobs/run/tistory/tistory.list   {}

# 5) 발행(첫 시도는 visibility 생략 → private)
#    POST /api/w/ws-alpha/jobs/run/tistory/tistory.publish
#       { "title":"...", "contentMarkdown":"...", "tag":["a"], "visibility":"private" }
```

## 제약 / 주의

- **비공식 API**: 티스토리 관리 UI가 바뀌면 엔드포인트/페이로드가 달라질 수 있다. 깨지면 `scripts/capture-session.mjs`로 다시 캡처해 계약을 갱신한다.
- **약관**: 자동화는 회색지대. 본인 블로그·본인 글 발행으로 한정한다.
- **세션 만료**: storage_state는 주기적으로 재추출해야 한다(무인 운영의 약점).
- **본문**: `marked` HTML로 변환한다. 코드블록 문법 하이라이트는 티스토리 스킨/플러그인에 의존한다.
- **카테고리**: `category`는 ID로 받는다. 이름↔ID는 `GET /manage/category/simple.json`으로 확인(예: `811911`).
