import { Clipboard, Circle, CheckCircle, MinusCircle, X } from "lucide-react";
import { Renderer } from "../../shared/RendererHeader";

type Props = {
  todoData: Record<string, unknown>;
};

export const TodoUpdateRenderer = ({ todoData }: Props) => {
  const newTodos = Array.isArray(todoData.newTodos) ? todoData.newTodos : [];

  const getTodoStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "in_progress":
        return <MinusCircle className="w-4 h-4 text-yellow-500" />;
      case "pending":
        return <Circle className="w-4 h-4 text-gray-500" />;
      default:
        return <X className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <Renderer
      className="bg-purple-50 border border-purple-200"
      enableToggle={false}
    >
      <Renderer.Header
        title="할 일 목록 업데이트"
        icon={<Clipboard className="w-4 h-4 text-purple-600" />}
        titleClassName="text-purple-800"
      />
      <Renderer.Content>
        {newTodos.length > 0 && (
          <div>
            <div className="text-xs font-medium text-gray-600 mb-1">
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
                      className={
                        todo.status === "completed"
                          ? "line-through text-gray-500"
                          : ""
                      }
                    >
                      {todo.content}
                    </span>
                    <span className="text-xs text-gray-500">
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
