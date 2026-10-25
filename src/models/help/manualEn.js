// Manager manuals (en). Same structure as manualPt.js — keep the three languages in sync.
export const MANUAL_EN = {
  manager: {
    dashboard: {
      summary: "The company overview for the open period (by default, from the 21st to the 20th). It shows what comes in, what goes out and what is waiting for a decision from you.",
      means: [
        ["Result · Estimate", "While the period is open it is an estimate. “To receive” (what contractors pay) minus “Staff” (what the team is paid, with reimbursements) gives the Margin, in € and as a % of what is received. Contractors with no price are left out."],
        ["Where it comes from · no price", "Shows which contractors the amount received comes from. “no price · left out” warns about contractors or clients with no price, which are left out of the calculation."],
        ["Pending items", "What needs you: overtime to approve, clients to confirm, hour splits to review, visits to check, expenses to approve, unread notices, contracts about to end or ended… The number is the count and the arrow takes you to the page where it is resolved. “Up to date” = nothing pending."],
        ["Contractor months to close", "Contractor months that have already ended and haven't been closed yet (or that were reopened). Close them in Contractors."],
        ["Team highlights", "Top 5 by hours, with each person's praise and complaints. It shows the last closed periods or the open period in real time, as set in Settings."],
        ["Clients by city", "A map of Belgium and a list of how many clients there are in each city. Clients without a valid city appear in a notice for you to fix."],
        ["Complaints (gauge)", "Excellent, Fair or Critical, depending on the number of complaints this month compared with the limits you set in Settings."],
        ["Trend", "Chart of hours or € per period (€ / Hours button), with the average dashed and the change from the previous period."],
        ["Notes", "Your dated reminders. It also shows the next Belgian public holidays (“Holiday” tag), just as a reminder: they don't change the schedule."],
        ["“Period ended” banner", "After the period ends there is a deadline (Settings) to finish it. Once it passes, the Dashboard and the entries are locked until you close the period in Hours."],
      ],
      howto: [
        { q: "How do I see whether the month is going well?", steps: ["Look at the Result card: the estimated margin.", "Check the Pending items: everything with a number is work to do.", "Click the arrow on an item to go straight to resolving it."] },
      ],
    },
    clientes: {
      summary: "The list of active clients, with contract, team and hours for the period. Open a client to see and edit the full record.",
      means: [
        ["Hours in the period (bar)", "Hours done / hours planned up to today, according to the schedule and the client's data. “On track”, “Behind Xh” or “Over +Xh” tells you whether it is within plan. “No planned visits” = the client is on nobody's schedule."],
        ["Contract ending · Expired", "A tag when only a few days are left on the contract (the warning is set in Settings) or when it has already passed."],
        ["Team", "Who has this client on their schedule. “+N” = there are more people."],
        ["Fixed · Replacement", "Fixed is a normal client. Replacement is temporary and needs a start and an end date."],
        ["Frequency", "Weekly, biweekly, monthly or every other day. It decides in which weeks and days the visit shows up in the schedule."],
        ["How hours are counted", "“Split between the team”: the client's hours are shared among the people working there. “Individual”: everyone logs the full duration."],
        ["Contractor", "Who pays for this client's hours (created in Contractors). The hourly rate comes pre-filled with the contractor's default, but you can change it."],
        ["Documents", "Contract, proof of address, insurance/licence… are kept in a private vault only management can see (up to 10 MB each)."],
        ["Complaints and praise", "History by year, kept from the notices that were sent."],
      ],
      howto: [
        { q: "How do I create a client?", steps: ["Click New client.", "Fill in name, type, city (pick one from the list), address and contact.", "Set the contract, hours per month, hourly rate and visit duration.", "Choose the weekdays, the frequency and the contractor.", "Save. For someone to start doing it, add it to the schedule in Schedules."] },
        { q: "I changed a client's duration. What about hours already logged?", steps: ["When you save, the app asks whether to apply it to the open period's entries.", "Anyone already paid is left untouched.", "Later you can also use Hours → Recalculate hours."] },
        { q: "How do I send a client's details to someone?", steps: ["Open the client's record and click Copy details.", "Choose whether to include the note (code, key…) and copy the text.", "Paste it into WhatsApp, SMS or email."] },
        { q: "How do I delete clients?", steps: ["Select one or several and click Delete.", "They are also removed from the schedules. The history of periods already closed is not affected."] },
      ],
    },
    contratantes: {
      summary: "Contractors are who pays the company for the hours done at clients. Here you set what each one pays, the report cycle, and close each one's month.",
      means: [
        ["Pays per hour · Pays the employee", "What the contractor pays per hour and what the employee is paid (default for new clients). The difference is the margin per hour."],
        ["Direct · Price per client", "Direct clients have no contractor: each client has its own price, set in the client's record."],
        ["Invoicing · Payment", "The day of the month you invoice and the payment term (in days), counted from the end of the period."],
        ["Report period", "By default the general one (21st to 20th, every month). You can give a contractor its own period: other days, or repeating every 2 or more months."],
        ["Month states", "In progress (period still open) · To close (ended, not yet closed) · Closed (values frozen) · Reopened (can change again) · No hours."],
        ["Hourly rate missing", "Without a price, the contractor is not counted in the Dashboard's “to receive” total."],
        ["Colour", "Each contractor has a fixed colour in the charts."],
      ],
      howto: [
        { q: "How do I create a contractor?", steps: ["Click New contractor.", "Enter the name, the hourly rate they pay and what the employee is paid.", "Set the invoicing day and the payment term.", "Save. Then choose it in each client's record."] },
        { q: "How do I close a contractor's month?", steps: ["Open the contractor and go to Months → Close month.", "The assistant has 4 steps: Review (pending items), Cross-check, Attach (documents) and Close.", "Once closed, the values are frozen.", "To correct, use Reopen (it asks for a reason)."] },
        { q: "How do I download the hours report as a PDF?", steps: ["Open the contractor → Hours reports.", "Click View report and then Download PDF.", "For each client the report shows how many visits were done, the hours and who did them (no dates)."] },
        { q: "“N clients without a contractor” appeared.", steps: ["The origin written on those clients doesn't match any contractor.", "Choose each one's contractor right in the list."] },
      ],
    },
    agendas: {
      summary: "Each employee's typical week: which clients they do on each day. It repeats every week until you change it.",
      means: [
        ["By employee · By day", "Two views: one row per employee with the 7 days, or one day at a time with the clients and who does them."],
        ["Duration and total", "Each client shows the visit duration. Under the employee's name you see their hours for the week."],
        ["Orange · Shared", "2 or more people at the same client on the same day: they become a team and the duration is split between them (the badge shows how many)."],
        ["Frequency colours", "The legend at the top explains: violet = biweekly client, blue = monthly, amber = every other day. The arrows icon also marks biweekly and monthly ones."],
        ["Absent · No cover", "“Absent”: the employee reported they will be off. “No cover”: that person's clients that don't yet have someone else on that day."],
        ["Today", "Today is highlighted in the week."],
        ["“covering X” · “covered by Y”", "The client is part of a holiday cover: temporarily done by someone else."],
      ],
      howto: [
        { q: "How do I put a client on someone's schedule?", steps: ["Hover over the employee's day (on a phone, tap it) and click the dashed + that appears.", "Search for the client and pick it."] },
        { q: "How do I add or remove a person from a client?", steps: ["Click the client: “who is at the client” opens.", "Use Add to put another employee, or Remove to take one off."] },
        { q: "How do I send someone's clients by message?", steps: ["Under the employee's name click Copy the week's clients… (in the By day view: Copy day's clients…).", "Choose whether to include the note (code, key…): by default it is left out.", "Click Copy and paste it into WhatsApp, SMS or email."] },
        { q: "How do I cover someone's holidays?", steps: ["Click Holiday cover.", "Choose who will be away and the dates.", "Choose who covers (everything to one person, or client by client) and click Create cover.", "The day after it ends, the clients go back to their owner by themselves."] },
        { q: "Someone reported an absence. What do I do?", steps: ["“Absent” shows in the schedule and in the Pending items.", "Move their clients to someone else (cover or schedule).", "Mark the absence as resolved."] },
        { q: "How do I open a client's record?", steps: ["Click the client's name and choose Open client record."] },
      ],
    },
    horas: {
      summary: "Where you confirm each employee's hours, pay them and close the period. Each person logs their hours on their phone; here you check, correct and approve.",
      means: [
        ["To pay in the period (green card)", "The total to pay the team in the open period, with how many are paid, unpaid and pending."],
        ["Pending", "The employee hasn't finished the month yet."],
        ["Unpaid", "The employee has finished the month. You still have to pay and mark as paid."],
        ["Paid", "Payment marked. Hours are locked: to correct, undo the payment first."],
        ["Reopened", "The month was reopened for correction and the person can change their hours again."],
        ["Attention (yellow row)", "Points for you: overtime to approve, client to confirm, split to review or a conflict. The reason shows alongside."],
        ["Extra · to approve", "Overtime requested by the employee, waiting for your approval."],
        ["Client to confirm", "The employee typed a client that isn't in the list. Choose which client it is."],
        ["Review split", "Someone's week was already closed when a colleague logged the same client, and the number of people changed. Click Split equally to share the hours among everyone."],
        ["Conflict · Alone", "One employee says they worked alone and another logged the same client. Until you decide, each keeps their split share."],
        ["Voided", "Voided row: it doesn't count towards hours, but you can restore it."],
        ["Reviews (n)", "Compares, week by week, the visits expected by the schedule with the logged ones: visit done on another day, extra visit, not logged, different hours… Nothing changes without your decision."],
      ],
      howto: [
        { q: "How do I pay an employee?", steps: ["Open the employee (they can only be paid after finishing the month).", "Click Mark as paid and confirm the date and total.", "Only confirm if you have made the payment: their month becomes locked."] },
        { q: "How do I close the period?", steps: ["Close period is only available when everyone is Paid (and expenses approved).", "When you close it, the period goes to History and a new blank one starts right away.", "This cannot be undone."] },
        { q: "How do I correct someone's hours?", steps: ["Open the employee.", "On the row, use the pencil to change the client or hours, or the X to void.", "If they're already Paid: undo the payment or use Reopen for correction."] },
        { q: "How do I export?", steps: ["Export PDF (general) at the top, for everyone.", "Export PDF inside an employee, for them only."] },
        { q: "I changed a client's duration. Are the old hours wrong?", steps: ["Use Recalculate hours: it adjusts this period's entries to the current duration.", "The split between colleagues and the extra minutes are kept; anyone already paid is skipped."] },
      ],
    },
    monitoramento: {
      summary: "Shows who has already filled in this week's hours and who has open days, so you can remind or help.",
      means: [
        ["Filled in · Forgot to fill in · Not yet", "Each day's status for the week: done, a day that has passed and is still empty, or a day that hasn't come yet."],
        ["Up to date · With missing days", "Summary at the top: how many employees are up to date and how many have open days."],
        ["Week OK", "The employee has already finished the week."],
        ["Inactive and replacement", "They don't show on this page."],
      ],
      howto: [
        { q: "How do I remind someone?", steps: ["Click Remind on the employee's row.", "They get a reminder with how many days are missing and the row reads “Reminded”."] },
        { q: "How do I fill in the hours for them?", steps: ["Click Fill in.", "What you log is marked “by management” and the employee can reopen the week as usual."] },
        { q: "How do I see someone's statement?", steps: ["Click the employee to see the full month, live."] },
      ],
    },
    historico: {
      summary: "All the periods already closed, with hours, amount paid and incidents. A period gets here when you close it in Hours.",
      means: [
        ["Amount paid · Hours", "The total paid to the team and the hours worked in that period, compared with the previous period."],
        ["Complaints · Praise · Notices · Requests", "How many there were in the period and how many were resolved."],
      ],
      howto: [
        { q: "How do I see a period's detail?", steps: ["Click the period.", "You see the month summary, the incidents and the hours per employee (click an employee to see day by day)."] },
        { q: "How do I delete a period?", steps: ["Select it and click Delete.", "You have to type DELETE to confirm.", "The record of hours, amounts and incidents is lost for good and the period leaves the charts. There is no way back."] },
      ],
    },
    avisos: {
      summary: "Management's inbox: complaints, praise, general notices and requests from the team.",
      means: [
        ["Requests", "Requests from the team, such as correcting a period's hours. Approve and reopen period unlocks that employee's month."],
        ["Complaints · Praise · General notices", "What the team (or you) logged about employees and clients. Complaints and praise go into the client's history and the Dashboard highlights."],
        ["Menu badge", "Counts only what you haven't seen yet. It disappears when you open Notices."],
        ["Period already closed", "A notice that belongs to a period that has already been closed."],
      ],
      howto: [
        { q: "How do I reply to a request?", steps: ["Open the request and click Reply.", "Write the reply and send it.", "When it is handled, mark it as resolved."] },
        { q: "How do I create a notice?", steps: ["Click New notice.", "Choose the type (Complaint, Praise or Notice), the employee, the client and write the text.", "You can add a photo, then send."] },
      ],
    },
    notas: {
      summary: "Your personal reminders, with a date.",
      means: [
        ["Today · Overdue · This week · Later", "Notes are grouped by date. Overdue = the date has passed."],
        ["Notifications", "If you turn them on for this device, you get the reminder even with the app closed."],
      ],
      howto: [
        { q: "How do I create and delete a note?", steps: ["Choose the date, write the reminder and click Add note.", "To delete, use the bin: you have 5 seconds to Undo."] },
      ],
    },
    funcionarios: {
      summary: "Each employee's record: details, account type, clients and documents.",
      means: [
        ["Fixed · Replacement · Supervisors · Inactive", "Filters at the top of the list. Replacement is a temporary account with an expiry date."],
        ["Ends in N days · Expired", "The validity of a temporary account. Expired account: extend the validity to reactivate it."],
        ["Role", "Employee, Supervisor or Management supervisor (uses the supervisor screen and can switch to management)."],
        ["Sees all clients", "Gives access to the full client list, not just the ones on their schedule."],
        ["Can log expenses to reimburse", "The employee logs, management approves. It goes into their report, separate from hours."],
        ["Partner (pair)", "With a pair, the schedule is filled in for both."],
        ["Known clients", "Shortcut: clients the person does now and then show up right away on their phone. It doesn't change the schedule."],
        ["Start date", "Empty = since the day the account was created. Put an earlier date if they worked before joining the app."],
        ["IBAN and documents", "The IBAN is shown masked (Show / Copy). Each document has the status Missing, Sent or Expired and is kept in a private vault, management only."],
      ],
      howto: [
        { q: "How do I create an employee?", steps: ["Click New Employee.", "Fill in the name, the person's real email, contact, account type and role.", "Enter the start date.", "At the end, click Create access account: copy the temporary password, it won't be shown again."] },
        { q: "How do I delete an employee?", steps: ["Select them and click Delete.", "Assignments and this week's pending hours are lost. The closed history is not affected."] },
      ],
    },
    acessos: {
      summary: "Who signs in to the app, with which email and which role.",
      means: [
        ["Employee", "Uses the app on their phone: hours, schedule, notices."],
        ["Supervisor", "Like the employee, and also sees Monitoring."],
        ["Management supervisor", "Uses the supervisor screen and can switch to management."],
        ["Management", "Full access, including payments and passwords."],
      ],
      howto: [
        { q: "How do I reset someone's access?", steps: ["Click Reset and confirm.", "Copy the temporary password right away: it isn't shown again.", "The person chooses their own password on first login."] },
        { q: "How do I change the role or the email?", steps: ["Open the person and change the role or the email.", "Changing the email also changes the login. Switching to Management asks for confirmation."] },
      ],
    },
    definicoes: {
      summary: "The company's data and rules. It is split into Profile, Payment, Alerts and Danger zone.",
      means: [
        ["Profile · Company data", "Name, photo and login email (the email can't be changed here). Address, company/VAT number, IBAN and phone appear in the header of PDF reports."],
        ["Period closing day", "A single value for the whole company. It controls the payment report in Hours and the automatic week cut-off in the employee's log."],
        ["Alerts", "How many days ahead to warn about a contract ending, the complaint gauge limits, the deadline to finish the month and how the Dashboard Top 5 is calculated."],
        ["Danger zone", "Change the account password and Format data."],
      ],
      howto: [
        { q: "How do I change the closing day?", steps: ["In Payment, choose the new day and confirm.", "It changes the cut-off for all future weeks and periods."] },
        { q: "What does Format data do?", steps: ["It permanently deletes clients, employees, hours, notices and history.", "You have to type FORMAT to confirm. The company's login account is not affected."] },
      ],
    },
  },
  staff: {},
};
