export interface Class {
  id: number;
  name: string;
}

export interface Student {
  id: number;
  class_id: number;
  name: string;
  tuition_rate: number;
  planned_sessions: number;
}

export interface Record {
  id?: number;
  student_id: number;
  date: string;
  status: 'present' | 'absent' | null;
  camera: number; // 0 or 1
  homework: number; // 0 or 1
  test_score: string;
  test_comment: string;
  comment: string;
  student_name?: string;
}
