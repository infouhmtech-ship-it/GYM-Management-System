# APEX Athletic Club

A gym operating portal for one club: the front desk, the coaches, the owner, and the members. Built as a MERN app (MongoDB, Express, React, Node).

Organic enquiries — walk-ins, Google, Instagram, WhatsApp, referrals, events, and the public form — sit in one pipeline with an owner and a next step. Joining copies that person onto a membership without retyping them. Check-in, class booking, freezes, renewals, and invoices use the same record.

The demo club is APEX Athletic Club, Gulberg III, Lahore. Money is in rupees.

## Run it

```bash
npm install --prefix server
npm install --prefix client
npm run dev
```

Open the address Vite prints, usually http://localhost:5173

The first launch downloads a local MongoDB binary and keeps the database in `server/data`. To start from the seed again, stop the app and delete `server/data`.

To use your own MongoDB instead, set `MONGO_URI` in `server/.env` (see `server/.env.example`).

## Sample logins

Password for every sample account: `apex2026`

| Person | Email | Sees |
| --- | --- | --- |
| Amina Khan, owner | amina.khan@apex.club | Books, plans, team |
| Omar Siddiqui, front desk | omar.desk@apex.club | Pipeline, check-in, billing |
| Hira Malik, coach | hira.coach@apex.club | Trials, classes, members |
| Saad Raza, member | saad.member@apex.club | His plan, classes, visits |

The public trial form is at `/join` on that same address. Submissions land on the desk’s due list the same day.

## What the desk can do

- Log an enquiry with source, goal, consent, and the next call.
- Book a trial, mark who showed, or close it as lost with a reason.
- Turn an enquiry into a member on a plan, take the payment, and optionally open a login.
- Check someone in by name, phone, or member code. Expired, frozen, cancelled, and off-peak visits are refused and still logged.
- Renew, freeze, and cancel without creating a second profile.
- Run the class timetable with capacity. Off-peak members cannot book after 4pm on weekdays.
- Record cash, card, transfer, and JazzCash / easyPaisa, including failed renewals.
