import axios from 'axios'
import type { ModuleMenu } from '../layout/Sidebar'

export async function fetchMenu(): Promise<ModuleMenu[]> {
  const res = await axios.get<ModuleMenu[]>('/api/menu')
  return res.data
}


