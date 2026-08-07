# Office-Link Frontend

Office-Link Frontend는 사내 업무 요청, 구조화된 Action Draft 승인, 업무 결과와 관측 지표를 제공하는 Vue 기반 단일 페이지 애플리케이션입니다.

## 주요 화면과 기능

- Azure 로그인과 사용자 세션 갱신
- 대화방 URL 라우팅, 메시지 이력, SSE 실시간 응답
- 회의실·방문객 주차·사무용품 목록 카드와 Action Draft Form
- 필수값 자동 추천을 포함한 빠른 실행과 최종 결과 갱신
- 오늘의 업무 바로가기, 음성 입력, 장기 대화 UX
- 마이페이지 사용량 차트와 관리자 관측 대시보드
- 반응형 레이아웃, Dark mode, 사용자 조작을 존중하는 자동 스크롤

## 기술 구성

- Node.js 22
- Vue 3, Vue Router, Pinia
- Vite 8
- Axios, Chart.js, markdown-it, DOMPurify
- Nginx 1.27

## 통합 실행

```powershell
Copy-Item .\deploy\.env.example .\deploy\.env
.\deploy\start.ps1
```

Nginx가 `http://localhost`의 단일 진입점으로 동작하며 다음 요청을 Final Backend로 프록시합니다.

- `/api/`
- `/oauth2/`
- `/login/oauth2/`

통합 배포에서는 별도의 Frontend `.env`가 필요하지 않습니다.

## 로컬 개발

```powershell
npm ci
npm run dev
```

기본 개발 주소는 `http://localhost:5173`입니다. Backend 주소가 동일 origin이 아닌 경우에만 로컬 환경에서 `VITE_API_BASE_URL`을 지정합니다.

## 명령

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | Vite 개발 서버 실행 |
| `npm test` | Node 기반 UI 유틸·상태 테스트 |
| `npm run build` | Production 번들 생성 |
| `npm run preview` | 생성된 번들 미리보기 |

최종 확인:

```powershell
npm test
npm run build
```

## 디렉터리

```text
src/
├─ api/          # Final Backend API와 SSE 클라이언트
├─ components/   # 채팅, Action Draft, 대시보드 UI
├─ router/       # 채팅·마이페이지·관리자 URL
├─ stores/       # 인증·대화 상태
├─ styles/       # 공통 테마와 반응형 스타일
├─ utils/        # 표시값 변환과 화면 상태 유틸
└─ views/        # 페이지 단위 화면
```

## 보안 메모

- 브라우저 번들에 API Key나 Client Secret을 넣지 않습니다.
- 인증 Cookie는 Backend가 관리하며 API 요청은 `withCredentials`와 CSRF 계약을 따릅니다.
- Markdown은 DOMPurify로 정제한 뒤 렌더링합니다.

## 관련 문서

- [통합 프로젝트 README](https://github.com/metanet-final-proj/Office-Link-Deploy)
- [통합 배포 가이드](https://github.com/metanet-final-proj/Office-Link-Deploy/tree/main/deploy)
- [보안 정책](SECURITY.md)
