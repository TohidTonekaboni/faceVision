import { useQuery } from "@tanstack/react-query";
import { delay } from "../data/mockApi";
import { USERS } from "../data/users";

export function useUsers() {
  return useQuery({ queryKey: ["users"], queryFn: () => delay(USERS) });
}
