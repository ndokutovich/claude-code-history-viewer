import { X } from "lucide-react";

type Props = {
  error: string;
};

export const ErrorRenderer = ({ error }: Props) => {
  // Extract the error details
  const errorMessage = error.replace("Error: ", "");

  return (
    <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-center space-x-2 mb-2">
        <X className="w-4 h-4 text-red-500" />
        <span className="font-medium text-red-800">도구 실행 오류</span>
      </div>
      <div className="text-sm text-red-700 whitespace-pre-wrap max-h-80 overflow-y-scroll">
        {errorMessage}
      </div>
    </div>
  );
};
