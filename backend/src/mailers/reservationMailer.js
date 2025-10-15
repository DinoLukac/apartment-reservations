import { sendMail } from "../utils/email.js"

function icsFromReservation(r) {
  const dt = (d) =>
    new Date(d).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Apartmani//RS",
    "BEGIN:VEVENT",
    `UID:${r.code}@apartmani`,
    `DTSTAMP:${dt(new Date())}`,
    `DTSTART:${dt(r.checkIn)}`,
    `DTEND:${dt(r.checkOut)}`,
    `SUMMARY:Rezervacija ${r.code}`,
    `DESCRIPTION:Gost: ${r.guest.fullName} (${r.guest.email})`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n")
}

export async function sendReservationConfirmation(r) {
  const ics = icsFromReservation(r)
  const to = r.guest.email

  await sendMail({
    to,
    subject: `Potvrda rezervacije ${r.code}`,
    text: `Hvala! Rezervacija ${
      r.code
    }\nDatumi: ${r.checkIn.toDateString()}–${r.checkOut.toDateString()}\nUkupno: ${
      r.total
    } ${r.currency}`,
    attachments: [
      {
        filename: `rezervacija-${r.code}.ics`,
        content: ics,
        contentType: "text/calendar",
      },
    ],
  })
}

// TODO: SMS/OTP u sljedećem sprintu (trenutno stub)
export function sendReservationSmsStub(r) {
  console.log(`[sms-stub] Rezervacija ${r.code} gost ${r.guest?.fullName}`)
}
