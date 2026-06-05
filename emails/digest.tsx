/**
 * React Email template placeholder for Qlass daily digests.
 * Install @react-email/components and render with your SMTP job.
 */
export function DigestEmail({
  userName,
  items,
}: {
  userName: string;
  items: { title: string; body?: string; link?: string }[];
}) {
  return (
    <html>
      <body style={{ fontFamily: "system-ui, sans-serif" }}>
        <h1>Qlass daily digest</h1>
        <p>Hi {userName},</p>
        <ul>
          {items.map((item, i) => (
            <li key={i}>
              <strong>{item.title}</strong>
              {item.body && <p>{item.body}</p>}
            </li>
          ))}
        </ul>
      </body>
    </html>
  );
}
