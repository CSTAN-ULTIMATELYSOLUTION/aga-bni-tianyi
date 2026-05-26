# TIAN YI OneSystem Project Info

## Launch Goal

- Target: public live launch.
- Production domain: `https://tianyi.agaventures.ai`.
- Development priority: get member submission and admin control working reliably first.
- Current execution mode: work locally first, then push to GitHub.

## Product Name

- Final name: TIAN YI OneSystem.
- Game date range: 01 Jun 2026 - 31 Jul 2026.
- The game is a one-time campaign/purpose.

## Route Structure

- `/website`: Tianyi website, admin portal entry context, and game introduction.
- `/members`: member profiles, services, and contact information. No ranking.
- `/catalog`: services and products from BNI TIAN YI members.
- `/game`: game rules page and leaderboard.
- `/game/weeklyupdate`: only member submission page.
- `/admin`: hidden from public navigation.
- Old `/submission/:id` links should continue working.

All routes should be bilingual, with Chinese first.

## Audience

- Website, members, and catalog: public-facing for all audiences.
- Game and admin: internal for BNI Tian Yi.

## Design Direction

- Theme: TIAN YI theme.
- Visual direction: red and white, more aligned with Tian Yi branding.
- Current dark blue/gold style should be replaced later.
- Mobile-first for public/member/game flows.
- Desktop admin should remain professional and admin-oriented.
- Demo devices: phone and laptop.
- Logos, fonts, and design theme will be provided later.
- AGA ad popup in admin should stay.

## Content Inputs Still Needed

- Full website content for `/website`.
- Member page content for `/members`.
- Catalog/service/product content for `/catalog`.
- Game page copy for `/game`.
- Logos and font files or references.
- Final Tian Yi design theme.

## Authentication

- Admin login should use password for this phase.
- Multiple admin users are expected: start with one, later likely three or more.
- Admin route should not appear in public navigation.
- Local preview/demo buttons should remain visible only on localhost.

## Admin Emails

- Initial admin email: to be provided.
- More admin emails may be added later.

## Members

- There are 84 members.
- Final member list will be provided soon.
- Required member fields for now:
  - Full name
  - Email
  - Company
  - Report/score data visibility
  - Buddy pair/team assignment
- Admins should be able to edit member list.
- Admins should be able to assign and edit buddy pairs/teams.
- Admins should be able to deactivate/delete members.

## Buddy Pair Logic

- Buddy model: 2 members per pair.
- 84 members means around 41-42 buddy pairs.
- Ranking is by buddy pair.
- A member cannot be without a buddy pair.
- A buddy pair cannot contain more than 2 members.
- Admin linking two buddy members can also assign/update their pair/team.
- Number of teams/pairs will be updated later.

## Game Rules

Final scoring rules:

- 1-2-1: 1 point each, max 2.
- Training: 5 points each, max 3.
- Referral: 5 points each, max 50.
- TYFCB:
  - RM100 = 1 point
  - RM1,000 = 3 points
  - RM10,000 = 6 points
  - RM20,000 = 9 points
  - RM30,000 = 12 points
- Visitor: 10 points each.
- Visitor joined: 25 points each.

## Submission Rules

- `/game/weeklyupdate` is the only member submission page.
- Members can submit zero activity.
- Members cannot edit submitted records.
- No double entry is allowed for the same member/week.
- Admin can archive a submitted record so the member can submit again.
- Rejected submissions should be recorded/archived and the member should be able to resubmit.
- Admin cannot amend submitted values for now.
- Before 01 Jun 2026: testing mode can allow Week 1 submission.
- After 01 Jun 2026: members can submit current week and previous week only.
- No next-week submission option.

## Evidence Rules

- Images only.
- Max upload size: 5MB.
- Proof photo is not required for every non-zero activity.
- Visitor joined does not require proof from member because admin will edit/confirm it in the admin portal.
- OCR may be useful, but ignore it if it requires extra token/API cost for now.

## Attendance

- Attendance should be marked by admin only.
- Attendance should be removed from member submission form.
- Attendance bonus should depend on admin-marked attendance only.
- Admin attendance marking should affect existing submission scores automatically.
- Full attendance bonus rule remains:
  - Admin-marked attended
  - 1-2-1 > 0
  - Training > 0
  - Referrals > 0
  - TYFCB > 0
  - Visitors > 0

## Admin Control

- Admin can manage members.
- Admin can assign/edit buddy pairs and pair ranking structure.
- Admin can mark attendance.
- Admin can approve/reject submissions/proof.
- Approval/rejection should affect score.
- If a submission is rejected, it should be archived/recorded and member can resubmit.
- Admin does not need CSV export today.

## Emails

- Resend API key will be provided later.
- Domain verified: `agaventures.ai`.
- Sender format: `Tian Yi Game <admin@agaventures.ai>`.
- Submission confirmation emails go to members only.
- Rejection emails go to members only.
- Admins should receive email notifications for new submissions.
- Need to confirm whether admin notifications can BCC more than one email.
- Rejection email should include:
  - Rejection reason
  - General link for member to submit again

## Database / Supabase

- Supabase production is believed to be set up, but needs checking.
- Need separate schema and bucket for this project.
- Need verify actual environment values; `.env.example` may not be final.
- Need confirm migrations are applied.
- Need confirm storage bucket and policies.

## Deployment

- Vercel project is connected.
- For now: local work first, then push to GitHub.

## Top Priority

1. Member submission flow.
2. Admin control flow.
3. Correct scoring and resubmission behavior.
4. Correct buddy pair leaderboard.
5. Correct attendance handling.

