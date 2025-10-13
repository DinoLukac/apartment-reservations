export const errorHandler = (err, _req, res, _next) => {
  console.error(err)
  // Avoid 413 visible to users; translate certain errors to 200 with payload
  if (
    err &&
    (err.code === "LIMIT_FILE_SIZE" || err.type === "entity.too.large")
  ) {
    return res
      .status(200)
      .json({
        ok: false,
        error: "Fajl je prevelik za obradu na serveru (limit 25MB po fajlu).",
      })
  }
  const status = err.status || 500
  res.status(status).json({ error: err.message || "Internal error" })
}
