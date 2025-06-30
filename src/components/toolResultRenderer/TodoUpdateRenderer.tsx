import { Clipboard, Circle, CheckCircle, MinusCircle, X } from "lucide-react";
import { Renderer } from "../../shared/RendererHeader";
import { COLORS } from "../../constants/colors";
import { cn } from "../../utils/cn";

type Props = {
  todoData: Record<string, unknown>;
};

export const TodoUpdateRenderer = ({ todoData }: Props) => {
  const newTodos = Array.isArray(todoData.newTodos) ? todoData.newTodos : [];

  const getTodoStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <CheckCircle
            className={cn("w-4 h-4", COLORS.semantic.success.icon)}
          />
        );
      case "in_progress":
        return (
          <MinusCircle
            className={cn("w-4 h-4", COLORS.semantic.warning.icon)}
          />
        );
      case "pending":
        return <Circle className={cn("w-4 h-4", COLORS.ui.text.muted)} />;
      default:
        return <X className={cn("w-4 h-4", COLORS.ui.text.muted)} />;
    }
  };

  return (
    <Renderer
      className={cn(
        COLORS.tools.search.bg,
        "border",
        COLORS.tools.search.border
      )}
      enableToggle={false}
    >
      <Renderer.Header
        title="할 일 목록 업데이트"
        icon={<Clipboard className={cn("w-4 h-4", COLORS.tools.search.icon)} />}
        titleClassName={COLORS.tools.search.text}
      />
      <Renderer.Content>
        {newTodos.length > 0 && (
          <div>
            <div
              className={cn(
                "text-xs font-medium mb-1",
                COLORS.ui.text.tertiary
              )}
            >
              현재 상태:
            </div>
            <div className="space-y-1">
              {newTodos.map(
                (
                  todo: { content: string; status: string; priority: string },
                  idx: number
                ) => (
                  <div
                    key={idx}
                    className="text-sm flex items-center space-x-2"
                  >
                    {getTodoStatusIcon(todo.status)}
                    <span
                      className={cn(
                        todo.status === "completed"
                          ? `line-through ${COLORS.ui.text.primary}`
                          : COLORS.ui.text.disabledDark
                      )}
                    >
                      {todo.content}
                    </span>
                    <span className={cn("text-xs", COLORS.ui.text.muted)}>
                      ({todo.priority})
                    </span>
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </Renderer.Content>
    </Renderer>
  );
};
