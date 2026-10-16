import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PageBuilder from "./PageBuilder";
import ConditionsPanel from "../../components/PageBuilder/ConditionsPanel";
import {
  getTemplate,
  createTemplate,
  updateTemplate,
  type TemplateType,
  type TemplateConditions,
} from "../../api/templates";
import "./HeaderFooter.css";

const HeaderFooterBuilder = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const templateId = searchParams.get("id");
  const templateType = (searchParams.get("type") || "header") as TemplateType;

  const [conditions, setConditions] = useState<TemplateConditions>({
    include: [],
    priority: 0,
  });
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(!!templateId);

  useEffect(() => {
    if (!templateId) return;
    const load = async () => {
      try {
        const t = await getTemplate(templateId);
        setConditions(t.conditions || {});
        setIsDefault(t.is_default || false);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [templateId]);

  const loadTemplate = useCallback(async () => {
    if (!templateId) return null;
    const template = await getTemplate(templateId);
    return {
      title: template.title,
      slug: template.slug,
      layout: template.layout,
      status: template.status,
      globals: template.globals,
    };
  }, [templateId]);

  const saveTemplate = useCallback(
    async (data: any) => {
      const payload = {
        title: data.title,
        slug: data.slug,
        layout: data.layout,
        status: data.status,
        globals: data.globals,
        template_type: templateType,
        conditions,
        is_default: isDefault,
      };

      if (templateId) {
        return await updateTemplate(templateId, payload);
      }

      const result = await createTemplate(payload);
      navigate(
        `/admin/appearance/header-footer/edit?id=${result.id}&type=${templateType}`,
        { replace: true },
      );
      return result;
    },
    [conditions, isDefault, navigate, templateId, templateType],
  );

  if (loading) return <div className="hf-loading">Loading...</div>;

  return (
    <PageBuilder
      mode="template"
      templateType={templateType}
      templateId={templateId}
      conditions={conditions}
      isDefault={isDefault}
      onConditionsChange={setConditions}
      onDefaultChange={setIsDefault}
      renderExtraPanel={() => (
        <ConditionsPanel
          conditions={conditions}
          onChange={setConditions}
          isDefault={isDefault}
          onDefaultChange={setIsDefault}
        />
      )}
      loadHandler={loadTemplate}
      saveHandler={saveTemplate}
    />
  );
};

export default HeaderFooterBuilder;