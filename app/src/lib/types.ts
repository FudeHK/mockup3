export type Role = 'admin' | 'staff';

export type Me = {
  userId: string;
  role: Role;
  storeId: string;
  storeName: string;
  aliasId: string | null;
  aliasName: string | null;
};

export type Template = { key: string; name: string; sort: number; description: string; questions: string[] };

export type Manual = {
  id: string;
  store_id: string;
  template_key: string | null;
  title: string;
  status: 'draft' | 'published';
  version: number;
  has_unpublished_changes: boolean;
  draft_started_at: string;
  first_published_at: string | null;
  published_at: string | null;
  creation_seconds: number | null;
  updated_at: string;
};

export type Step = {
  id: string;
  manual_id: string;
  store_id: string;
  position: number;
  question: string;
  body: string;
  photo_path: string | null;
};

export type RevisionStep = { id: string; no: number; question: string; body: string; photo_path: string | null };

export type Revision = {
  id: string;
  manual_id: string;
  version: number;
  title: string;
  steps: RevisionStep[];
  note: string;
  published_at: string;
};

export type Confusion = {
  id: string;
  manual_id: string;
  manual_title: string;
  manual_version: number;
  step_no: number;
  step_text: string;
  alias_name: string;
  created_at: string;
  resolved_at: string | null;
};

export type Alias = { id: string; name: string; active: boolean };

export type QuizQuestion = {
  id: string;
  manual_id: string;
  step_id: string | null;
  step_no: number | null;
  question: string;
  choices: string[];
  correct_index: number;
};
