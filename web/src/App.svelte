<script>
    import Router from "svelte-spa-router";
    import Login from "./routes/Login.svelte";
    import GroupAdmin from "./routes/GroupAdmin.svelte";
    import Dashboard from "./routes/Dashboard.svelte";
    import Toaster from "./components/Toaster.svelte";

    const routes = {
        "/login": Login,
        "/group-admin": GroupAdmin,
        "/": Dashboard,
        "/dashboard/:view": Dashboard,
        "*": Dashboard,
    };
</script>

<Router {routes} />
<Toaster />
