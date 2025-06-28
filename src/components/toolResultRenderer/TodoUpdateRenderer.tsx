import { Clipboard } from "lucide-react";
import { getTodoStatusColor } from "../../utils/color";

type Props = {
  todoData: Record<string, unknown>;
};

export const TodoUpdateRenderer = ({ todoData }: Props) => {
  const newTodos = Array.isArray(todoData.newTodos) ? todoData.newTodos : [];
  const oldTodos = Array.isArray(todoData.oldTodos) ? todoData.oldTodos : [];

  return (
    <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
      <div className="flex items-center space-x-2 mb-2">
        <Clipboard className="w-4 h-4" />
        <span className="font-medium text-purple-800">할 일 목록 업데이트</span>
      </div>

      {oldTodos.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-medium text-gray-600 mb-1">
            이전 상태:
          </div>
          <div className="space-y-1">
            {oldTodos.map(
              (
                todo: { content: string; status: string; priority: string },
                idx: number
              ) => (
                <div key={idx} className="text-sm flex items-center space-x-2">
                  <span
                    className={`w-4 h-4 rounded ${getTodoStatusColor(
                      todo.status
                    )}`}
                  ></span>
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
                <div key={idx} className="text-sm flex items-center space-x-2">
                  <span
                    className={`w-4 h-4 rounded ${getTodoStatusColor(
                      todo.status
                    )}`}
                  ></span>
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
    </div>
  );
};
