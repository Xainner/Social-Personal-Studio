import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as repo from "@/db/repositories/saved-posts";
import type { PostStatus } from "@/types/domain";

const KEYS = {
  list: (filter: repo.PostFilter) => ["posts", filter] as const,
  root: ["posts"] as const,
  tags: ["post-tags"] as const,
};

export function usePosts(filter: repo.PostFilter = {}) {
  return useQuery({
    queryKey: KEYS.list(filter),
    queryFn: () => repo.listPosts(filter),
  });
}

export function useSavePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: repo.savePost,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.root }),
  });
}

export function useUpdatePostText() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      repo.updatePostText(id, text),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.root }),
  });
}

export function useSetPostStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: PostStatus }) =>
      repo.setPostStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.root }),
  });
}

export function useSetPostFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, favorite }: { id: string; favorite: boolean }) =>
      repo.setPostFavorite(id, favorite),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.root }),
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: repo.deletePost,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.root }),
  });
}

export function useTags() {
  return useQuery({ queryKey: KEYS.tags, queryFn: repo.listAllTags });
}

export function useAddTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, tag }: { postId: string; tag: string }) =>
      repo.addTagToPost(postId, tag),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.root });
      qc.invalidateQueries({ queryKey: KEYS.tags });
    },
  });
}

export function useRemoveTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ postId, tag }: { postId: string; tag: string }) =>
      repo.removeTagFromPost(postId, tag),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.root }),
  });
}
