import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../components/ui/tooltip";

type Props = {
  children: React.ReactNode;
  content: React.ComponentProps<typeof TooltipPrimitive.Content>;
} & Omit<React.ComponentProps<"button">, "children" | "title">;

export const TooltipButton = ({ children, content, ...props }: Props) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button {...props}>{children}</button>
      </TooltipTrigger>
      <TooltipContent>{content}</TooltipContent>
    </Tooltip>
  );
};
