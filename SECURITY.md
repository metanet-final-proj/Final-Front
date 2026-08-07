# Security Policy

- 취약점과 Secret 노출은 공개 Issue가 아닌 저장소 관리자 또는 GitHub Private Vulnerability Reporting으로 제보합니다.
- 브라우저 번들, `VITE_*`, 소스 코드에는 API Key, Client Secret, DB 비밀번호를 넣지 않습니다.
- 인증 Cookie와 CSRF token은 Backend 계약에 따라 처리하고, 사용자 Markdown은 정제 후 렌더링합니다.
- `.env`, 사용자 대화 내역, 진단 화면의 token·cookie를 커밋하거나 공개하지 않습니다.

전체 정책은 [통합 배포 저장소의 SECURITY.md](https://github.com/metanet-final-proj/Office-Link-Deploy/blob/main/SECURITY.md)를 따릅니다.
