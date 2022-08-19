import React, { useEffect, useState, useCallback } from 'react'
import blessed from 'blessed'
import { CosmWasmClient } from "@cosmjs/cosmwasm-stargate"
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
  const [selectedContractAddress, setSelectedContractAddress] = useState<string | undefined>(undefined)
  const [contractState, setContractState] = useState<any>(undefined)
  const [query, setQuery] = useState<any>(undefined)
  
  useEffect(() => {

    //client.queryContractSmart("wasm14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9s0phg4d", {"query_list": {}}).then(async contract => {
    //  const state = await jq.run('.', contract, { input: 'json', color: true})
    //  setContractState(state)
    //})
    
  }, [])
  
  const selectQuery = useCallback((queryName: string) => {
    if (!selectedContractAddress) {
      return
    }
    const contracts = Config.sharedInstance().config?.contracts
    if (!contracts) {
      return
    }
    const selectedContract = contracts[selectedContractAddress]
    if (!selectedContract) {
      return
    }
    setQuery(selectedContract.queries.find((query: any) => query.name === queryName))
  }, [selectedContractAddress])
  
  const sendQuery = useCallback((query: any) => {
    if (!selectedContractAddress) {
      return
    }
    d("querying with options", JSON.stringify(query))
    client.queryContractSmart(selectedContractAddress, query).then(async contract => {
      const state = await jq.run('.', contract, { input: 'json', color: true})
      setContractState(state)
    }).catch((error) => {
      d(error)
      setContractState(undefined)
    })
  }, [selectedContractAddress])
  
  return (
    <React.Fragment>
      <ContractPicker setSelectedContractAddress={setSelectedContractAddress} />
      <QueryPicker selectedContractAddress={selectedContractAddress} selectQuery={selectQuery} />
      <QueryOptions query={query} sendQuery={sendQuery} />
      <ContractState stateData={contractState} />
      <Debuggah tabIndex={5.0} />
    </React.Fragment>
  )
}

export default Contracts