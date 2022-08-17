import fs from 'fs'
import { d } from './DebugLog'
import { dirname } from 'path';

export default class Config {
  
  private static instance: Config
  root: string
  config?: any
  
  private constructor() {
    this.root = process.cwd()
    
    if (fs.existsSync(this.root + "/csli.json")) {
      try {
        const data = fs.readFileSync(this.root + "/csli.json")
        this.config = JSON.parse(data.toString())
        d(JSON.stringify(this.config))
      } catch {
        d("failed to parse config file, make sure your json is valid")
      }
    }
  }
  
  static sharedInstance() {
    if (!Config.instance) {
      Config.instance = new Config()
    }
    return Config.instance
  }


}
