export const getTodoStatusColor = (status: string) => {
  switch (status) {
    case "completed":
      return "bg-green-500";
    case "in_progress":
      return "bg-yellow-500";
    case "pending":
      return "bg-gray-300";
    default:
      return "bg-gray-300";
  }
};
