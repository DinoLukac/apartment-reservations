import { EventEmitter } from "events"
export const pubsub = new EventEmitter()
// helper: emituj “listing.updated”
export const emitListing = (payload) => pubsub.emit("listing.updated", payload)
