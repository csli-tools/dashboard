export interface wsCSLIPayload {
  "type": "block" | "tx" | "msg" | "address" | "contract",
  "identifier": string, // Use 'nada' if there are none of this type
  "data": any
}
