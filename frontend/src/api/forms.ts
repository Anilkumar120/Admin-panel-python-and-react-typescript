import axios from "axios";
import { API_URL } from "./config";

export interface FormSubmissionPayload {
  page_id: string;
  page_title: string;
  widget_id: string;
  fields: Record<string, string>;
  website?: string;
}

export interface FormSubmission extends FormSubmissionPayload {
  id: string;
  submitted_at: string;
}

export interface FormSubmissionResponse {
  items: FormSubmission[];
  total: number;
  page: number;
  limit: number;
}

const getHeaders = () => {
  const token = localStorage.getItem("access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const submitForm = async (payload: FormSubmissionPayload) => {
  const response = await axios.post(
    `${API_URL}/api/forms/submissions`,
    payload,
  );
  return response.data;
};

export const getFormSubmissions = async (
  page = 1,
  limit = 50,
): Promise<FormSubmissionResponse> => {
  const response = await axios.get(`${API_URL}/api/forms/submissions`, {
    headers: getHeaders(),
    params: { page, limit },
  });
  return response.data;
};
