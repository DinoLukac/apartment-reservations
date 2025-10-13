import { Property } from "../models/property.js"

export const listMyProperties = async (req, res, next) => {
  try {
    const rows = await Property.find({ ownerId: req.user.id })
      .select("_id name photos")
      .sort({ updatedAt: -1 })
      .limit(50)
    res.json(
      rows.map((x) => ({
        id: x._id,
        name: x.name,
        cover:
          x.photos?.sort((a, b) => a.order - b.order)[0]?.url ||
          x.photos?.[0]?.dataUrl ||
          null,
      }))
    )
  } catch (e) {
    next(e)
  }
}
