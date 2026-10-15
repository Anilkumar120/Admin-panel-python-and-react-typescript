import { useCallback, useEffect, useState } from "react";
import {
  getFormSubmissions,
  type FormSubmission,
} from "../../api/forms";

const PAGE_SIZE = 50;

const FormSubmissions = () => {
  const [items, setItems] = useState<FormSubmission[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSubmissions = useCallback(async () => {
    try {
      const response = await getFormSubmissions(page, PAGE_SIZE);
      setItems(response.items);
      setTotal(response.total);
      setError("");
    } catch (loadError) {
      console.error("FORM SUBMISSIONS LOAD ERROR:", loadError);
      setError("Unable to load form submissions. Check your access and try again.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

  return (
    <div className="content-page">
      <div className="page-heading">
        <div>
          <h1>Form Submissions</h1>
          <p>Review messages sent from forms on your website.</p>
        </div>
        <button
          type="button"
          className="content-secondary-button"
          onClick={() => {
            setLoading(true);
            setError("");
            void loadSubmissions();
          }}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      <div className="content-card">
        {error && <div role="alert" className="content-message-error">{error}</div>}
        {loading ? (
          <p>Loading submissions...</p>
        ) : items.length === 0 ? (
          <p>No form submissions yet.</p>
        ) : (
          <div className="form-submissions-list">
            {items.map((submission) => (
              <article className="form-submission-card" key={submission.id}>
                <header>
                  <strong>{submission.page_title || "Website form"}</strong>
                  <time dateTime={submission.submitted_at}>
                    {new Date(submission.submitted_at).toLocaleString()}
                  </time>
                </header>
                <dl>
                  {Object.entries(submission.fields).map(([name, value]) => (
                    <div key={name}>
                      <dt>{name}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>
        )}

        <div className="content-form-actions">
          <span>
            {total === 0 ? "0 submissions" : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}`}
          </span>
          <button
            type="button"
            className="content-secondary-button"
            onClick={() => {
              setLoading(true);
              setPage((current) => Math.max(1, current - 1));
            }}
            disabled={page <= 1 || loading}
          >
            Previous
          </button>
          <button
            type="button"
            className="content-secondary-button"
            onClick={() => {
              setLoading(true);
              setPage((current) => current + 1);
            }}
            disabled={page * PAGE_SIZE >= total || loading}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default FormSubmissions;
