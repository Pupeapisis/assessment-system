export type Role = 'admin' | 'assessor' | 'viewer'
export type AssessmentStatus = 'draft' | 'submitted' | 'reviewed'

export interface User {
  id: string
  name: string
  email: string
  role: Role
  created_at: string
}

export interface Category {
  id: string
  name: string
}

export interface Topic {
  id: string
  category_id: string
  title: string
  description: string | null
  active: boolean
  sort_order: number
  category?: Category
}

export interface Assessment {
  id: string
  user_id: string
  branch_name: string
  status: AssessmentStatus
  created_at: string
  user?: User
  results?: AssessmentResult[]
}

export interface AssessmentResult {
  id: string
  assessment_id: string
  topic_id: string
  comment: string | null
  score: number | null
  topic?: Topic
  images?: AssessmentImage[]
}

export interface AssessmentImage {
  id: string
  result_id: string
  image_url: string
  file_name: string | null
}

export interface Report {
  id: string
  assessment_id: string
  report_name: string
  logo_url: string | null
  show_images: boolean
  show_comments: boolean
  show_scores: boolean
  selected_topics: string[]
}
