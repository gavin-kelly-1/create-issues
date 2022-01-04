import { Toolkit } from 'actions-toolkit'
import { IssuesCreateResponseData } from '@octokit/types'



export function listToArray (list?: string[] | string) {
  if (!list) return []
  return Array.isArray(list) ? list : list.split(', ')
}