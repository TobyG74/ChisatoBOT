export interface GithubUser {
    login: string;
    name: string | null;
    avatar_url: string;
    html_url: string;
    bio: string | null;
    location: string | null;
    company: string | null;
    blog: string | null;
    public_repos: number;
    followers: number;
    following: number;
    created_at: string;
}
