define('ai-assistant:controllers/ai-usage', ['controller'], (Controller) => {

    return class extends Controller {

        checkAccess() {
            if (!this.getUser().isAdmin()) {
                throw new Espo.Exceptions.AccessDenied();
            }

            return true;
        }

        actionIndex() {
            this.main('ai-assistant:views/admin/ai-usage');
        }
    };
});
