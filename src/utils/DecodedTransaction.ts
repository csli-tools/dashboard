import { Fee, ModeInfo } from "cosmjs-types/cosmos/tx/v1beta1/tx"
import Long from "long"

export default interface DecodedTransaction {
  height: number
  hash: string
  code: number
  rawLog: string
  tx: {
    authInfo?: {
      signerInfos: DecodedSignerInfo[]
      fee?: Fee
    }
    body?: TxBody
    signatures: string[]
  }
  gasUsed: number
  gasWanted: number
}

export interface DecodedSignerInfo {
  publicKey?: any;
  modeInfo?: ModeInfo;
  sequence: Long;
}
