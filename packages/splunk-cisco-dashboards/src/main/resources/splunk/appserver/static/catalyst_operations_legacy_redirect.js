(function () {
    function redirect() {
        var url = new URL(window.location.href);
        var leaf = url.pathname.replace(/\/$/, '').split('/').pop();
        var view = leaf === 'dashboard_manager' ? url.hash.replace(/^#\/?/, '').split(/[/?&]/)[0] : leaf;
        if (view !== 'netops_catalyst_health' && !(leaf === 'dashboard_manager' && view === 'netops_catalyst_operations')) return;
        url.pathname = url.pathname.replace(/\/(?:dashboard_manager|netops_catalyst_health)\/?$/, '/netops_catalyst_operations');
        url.hash = '';
        window.location.replace(url.href);
    }
    redirect();
    window.addEventListener('hashchange', redirect);
})();
