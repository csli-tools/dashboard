import React, { useEffect, useState } from 'react'
import blessed from 'blessed'
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { Server } from 'ws'
import * as jq from 'node-jq'

import Debuggah from './panes/debug/debug'
import { d } from './services/DebugLog'
import Config from './services/Config'
import ContractPicker from './panes/contracts/contract-picker'
import QueryPicker from './panes/contracts/query-picker'
import QueryOptions from './panes/contracts/query-options'
import ContractState from './panes/contracts/contract-state'

interface ContractsProps {
  screen: blessed.Widgets.Screen
  client: CosmWasmClient
  wss: Server
}

const Contracts: React.FC<ContractsProps> = ({screen, client, wss }) => {
  const [selectedContractAddress, setSelectedContractAddress] = useState<string | undefined>("wasm14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9s0phg4d")
  const [contractState, setContractState] = useState<any>(undefined)
      
  useEffect(() => {
  //  client.getContracts(1).then(contracts => {
  //    d(contracts)
  //  })
  //  client.getContract("wasm14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9s0phg4d").then(contract => {
  //    
  //  })
    Config.sharedInstance()
    client.queryContractSmart("wasm14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9s0phg4d", {"query_list": {}}).then(async contract => {
      const state = await jq.run('.', contract, { input: 'json', color: true})
      setContractState(state)
    })
    
  }, [])
  
  return (
    <React.Fragment>
      <ContractPicker />
      <QueryPicker selectedContractAddress={selectedContractAddress} />
      <QueryOptions query={{
        "name": "List Lookup",
        "key": "query_list",
        "optional": [
          {
            "key": "limit",
            "valueType": "number"
          },
          {
            "key": "start_after",
            "valueType": "number"
          }
        ]
      }} />
      <ContractState stateData={contractState} />
      <Debuggah tabIndex={5.0} />
    </React.Fragment>
  )
}

export default Contracts