# Inventário de endpoints do ClassHero

## Convenções

- `:id`: segmento dinâmico normalizado; o nome semântico é definido no wrapper de domínio.
- Status listados são apenas os observados nas capturas, não uma enumeração de todos os status possíveis.

## Rotas observadas

| Método | Rota normalizada | Fonte | Status | Query keys | Body keys |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/accessibility/me` | 200 | — | — |
| `GET` | `/assignments/students/me` | 200 | `course_id`, `theme_id` | — |
| `POST` | `/auth/login-with-password` | 200 | — | `email`, `password` |
| `POST` | `/auth/logout` | 201 | — | — |
| `POST` | `/auth/send-code` | 200 | — | `email` |
| `GET` | `/auth/session` | 200 | — | — |
| `POST` | `/auth/set-password` | 200 | — | `password` |
| `POST` | `/auth/verify-code` | 201 | — | `code`, `email` |
| `GET` | `/championship/student/available` | 200 | — | — |
| `GET` | `/class-disciplines/:id` | 500 | — | — |
| `GET` | `/classes/my-disciplines` | 200 | `includeArchived` | — |
| `GET` | `/courses/:id/stream-cover` | 200 | — | — |
| `GET` | `/courses/:id/stream-mascote` | 200 | — | — |
| `GET` | `/courses/:id/student-details` | 200 | — | — |
| `GET` | `/courses/me/direct-enrollments` | 200 | — | — |
| `GET` | `/enrollments/available` | 200 | — | — |
| `GET` | `/enrollments/discipline-users` | 200 | `classDisciplineId`, `email` | — |
| `GET` | `/feedback/mine` | 200 | `limit`, `page` | — |
| `POST` | `/games/forca/guess` | 200 | — | `letter`, `puzzleId` |
| `POST` | `/games/forca/puzzle` | 200 | — | `materialId`, `mode`, `themeMissionMaterialId` |
| `POST` | `/games/forca/submit` | 200 | — | `attempts`, `bonusApplied`, `clientGameStatus`, `content_id`, `context`, `hintsUsed`, `materialId`, `missionId`, `mode`, `puzzleId`, `time_seconds`, `won`, `xpPreview` |
| `POST` | `/games/memory` | 200 | — | `materialId`, `mode`, `themeMissionMaterialId` |
| `GET` | `/games/memory/balance` | 200 | `session_id` | — |
| `POST` | `/games/memory/submit` | 200 | — | `content_id`, `context`, `matched_pairs`, `material_id`, `mode`, `score`, `session_id`, `theme_id`, `time_seconds`, `wrong_attempts` |
| `POST` | `/games/memory/validate` | 200 | — | `card_ids`, `session_id` |
| `POST` | `/games/word-search` | 200, 409 | — | `materialId`, `mode`, `themeMissionMaterialId` |
| `GET` | `/games/word-search/balance` | 200 | `game_id` | — |
| `POST` | `/games/word-search/start` | 200 | — | `game_id` |
| `POST` | `/games/word-search/submit` | 200 | — | `content_id`, `found_words`, `game_id`, `hints_used`, `material_id`, `mode` |
| `GET` | `/gamification/assets/stream` | 200 | `key` | — |
| `GET` | `/gamification/character-base-model` | 200 | — | — |
| `POST` | `/gamification/equip` | 201 | — | `item_id`, `slot_key` |
| `GET` | `/gamification/me` | 200 | — | — |
| `POST` | `/gamification/pedagogical-credits/purchase` | 201 | — | `credits`, `theme_id` |
| `GET` | `/gamification/shop` | 200 | — | — |
| `POST` | `/gamification/unequip` | 201 | — | `slot_key` |
| `GET` | `/gamification/wallet` | 200 | — | — |
| `GET` | `/learn-profile/me/current` | 200 | — | — |
| `GET` | `/learn-profile/me/status` | 200 | — | — |
| `GET` | `/learn-profile/questionnaire/current` | 200 | — | — |
| `GET` | `/live-sessions/mine` | 200 | — | — |
| `GET` | `/missions/:id/journey-map/:id/background-image` | 200 | `v` | — |
| `POST` | `/missions/:id/journey-map/:id/student/nodes/gamified_path/complete` | 200 | — | — |
| `GET` | `/missions/:id/journey-map/:id/student/session` | 200 | — | — |
| `POST` | `/missions/:id/journey-map/:id/student/session` | 200 | — | `last_node_key` |
| `GET` | `/missions/:id/journey-map/:id/student/video-status` | 200 | — | — |
| `GET` | `/missions/:id/journey-map/:id/teacher-image/closing` | 200 | `v` | — |
| `GET` | `/missions/:id/journey-map/:id/teacher-image/opening` | 200, 304 | `v` | — |
| `GET` | `/missions/:id/journey-map/:id/videos/opening` | 206 | `v` | — |
| `POST` | `/missions/:id/journey-map/:id/videos/opening/student/progress` | 200 | — | `completed`, `current_position_seconds`, `duration_seconds`, `max_watched_seconds`, `watched_percentage` |
| `GET` | `/missions/:id/journey-map/student` | 200 | — | — |
| `GET` | `/missions/:id/journey-map/student/progress` | 200 | — | — |
| `GET` | `/missions/:id/knowledge-maps/final/student` | 200 | — | — |
| `POST` | `/missions/:id/knowledge-maps/final/student/opened` | 200 | — | — |
| `GET` | `/missions/:id/knowledge-maps/initial/student` | 200 | — | — |
| `POST` | `/missions/:id/knowledge-maps/initial/student/opened` | 200 | — | — |
| `GET` | `/missions/:id/pedagogical-credits/balance` | 200 | — | — |
| `GET` | `/notification-preferences/me` | 200 | — | — |
| `PUT` | `/notification-preferences/me` | 200 | — | `preference_mode`, `selected_types` |
| `GET` | `/notification-preferences/types` | 200 | — | — |
| `GET` | `/notifications` | 200 | `limit`, `target_email` | — |
| `POST` | `/notifications/mark-all-read` | 200 | — | `target_email` |
| `GET` | `/product-updates` | 200 | `includeInternal`, `limit`, `page` | — |
| `GET` | `/product-updates/latest-date` | 200 | — | — |
| `POST` | `/product-updates/seen` | 201 | — | — |
| `GET` | `/quizzes/attempt/:id/active-attempt` | 200 | `all_available`, `level`, `quantity`, `theme_mission_material_id` | — |
| `GET` | `/quizzes/attempt/:id/latest-finished-attempt` | 200 | `theme_mission_material_id` | — |
| `PATCH` | `/quizzes/attempts/:id` | 200 | — | `last_access_at` |
| `GET` | `/quizzes/attempts/:id/questions/:id/json` | 200 | — | — |
| `GET` | `/quizzes/contests/mine` | 200 | `limit`, `page` | — |
| `GET` | `/research-surveys/available` | 200 | — | — |
| `GET` | `/research-surveys/pending/first` | 200 | — | — |
| `GET` | `/rewards/achievements` | 200 | — | — |
| `POST` | `/story-slides/:id/progress` | 200 | — | `completed_slides`, `current_slide`, `time_spent_seconds` |
| `GET` | `/story-slides/theme/:id/student` | 200 | — | — |
| `GET` | `/student-favorites` | 200 | — | — |
| `GET` | `/testimonials/mine` | 200 | — | — |
| `GET` | `/theme-materials/by-theme/:id` | 200 | — | — |
| `GET` | `/theme-materials/gamified-interactive-path/attempts/:id/credits/balance` | 200 | — | — |
| `POST` | `/theme-materials/gamified-interactive-path/attempts/start` | 201 | — | `level_key`, `material_id`, `mode` |
| `POST` | `/theme-materials/gamified-interactive-path/attempts/step` | 201 | — | `answer_payload`, `attempt_id`, `hints_used`, `step_id` |
| `POST` | `/theme-materials/mission-materials/:id/access-session` | 201 | — | `access_type` |
| `PATCH` | `/theme-materials/mission-materials/access-sessions/:id` | 200 | — | `duration_seconds`, `pages_viewed` |
| `GET` | `/themes/:id/badge-image` | 0 | `v` | — |
| `GET` | `/themes/:id/closure` | 200 | — | — |
| `GET` | `/themes/:id/mission-materials` | 200 | — | — |
| `GET` | `/themes/:id/mission-materials/:id/adaptive-brain-markdown/availability` | 200 | — | — |
| `GET` | `/themes/:id/mission-materials/:id/brain-markdown` | 200 | — | — |
| `GET` | `/themes/:id/mission-materials/:id/stream-pdf` | 200 | — | — |
| `GET` | `/themes/:id/my-bonus-dates` | 200 | — | — |
| `GET` | `/themes/by-course/:id` | 200 | — | — |
| `GET` | `/users/avatar/stream` | 0, 200 | `key` | — |
| `GET` | `/users/by-email` | 200 | `email` | — |
| `GET` | `/users/hero-level-up-notice` | 200 | — | — |
| `GET` | `/users/me/hero-avatar-credit-context` | 200 | — | — |
| `GET` | `/users/me/hero-identity-history` | 200 | — | — |
| `PATCH` | `/users/update-info` | 200 | — | `email`, `employer`, `github_url`, `name`, `occupation`, `show_real_identity` |
| `GET` | `/xp-progress/cards` | 200 | — | — |
| `GET` | `/xp-progress/discipline-total` | 200 | `course_id` | — |
| `GET` | `/xp-progress/missions` | 200 | `course_id` | — |
| `POST` | `/xp-progress/notify-missing-hero-names` | 201 | — | `course_id`, `student_identifiers` |
| `GET` | `/xp-progress/ranking-bulk` | 200 | `course_id` | — |
| `GET` | `/xp-progress/ranking-mission` | 200 | `course_id`, `limit`, `theme_id` | — |
| `POST` | `/xp-progress/refresh` | 201 | `course_id` | — |
| `GET` | `/xp-progress/summary` | 0, 200 | — | — |

