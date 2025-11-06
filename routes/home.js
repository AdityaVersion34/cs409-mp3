module.exports = function (router) {

    var homeRoute = router.route('/');

    homeRoute.get(function (req, res) {
        res.json({
            message: 'Welcome to the Task Management API',
            endpoints: {
                users: '/api/users',
                tasks: '/api/tasks'
            }
        });
    });

    return router;
}
