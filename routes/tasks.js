var Task = require('../models/task');
var User = require('../models/user');

module.exports = function (router) {

    var tasksRoute = router.route('/tasks');

    // GET /api/tasks - Get list of tasks with query parameters
    tasksRoute.get(function (req, res) {
        // Build query
        var query = Task.find();

        // Apply 'where' filter if provided
        if (req.query.where) {
            try {
                var whereFilter = JSON.parse(req.query.where);
                query = query.where(whereFilter);
            } catch (e) {
                return res.status(400).json({
                    message: "Bad Request: Invalid JSON in 'where' parameter",
                    data: {}
                });
            }
        }

        // Apply 'sort' if provided
        if (req.query.sort) {
            try {
                var sortOrder = JSON.parse(req.query.sort);
                query = query.sort(sortOrder);
            } catch (e) {
                return res.status(400).json({
                    message: "Bad Request: Invalid JSON in 'sort' parameter",
                    data: {}
                });
            }
        }

        // Apply 'select' if provided
        if (req.query.select) {
            try {
                var selectFields = JSON.parse(req.query.select);
                query = query.select(selectFields);
            } catch (e) {
                return res.status(400).json({
                    message: "Bad Request: Invalid JSON in 'select' parameter",
                    data: {}
                });
            }
        }

        // Apply 'skip' if provided
        if (req.query.skip) {
            query = query.skip(parseInt(req.query.skip));
        }

        // Apply 'limit' if provided, default to 100 for tasks
        if (req.query.limit) {
            query = query.limit(parseInt(req.query.limit));
        } else {
            query = query.limit(100);
        }

        // Check if 'count' is requested
        if (req.query.count === 'true') {
            query.countDocuments(function (err, count) {
                if (err) {
                    return res.status(500).json({
                        message: "Internal Server Error",
                        data: {}
                    });
                }
                res.status(200).json({
                    message: "OK",
                    data: count
                });
            });
        } else {
            // Execute query and return results
            query.exec(function (err, tasks) {
                if (err) {
                    return res.status(500).json({
                        message: "Internal Server Error",
                        data: {}
                    });
                }
                res.status(200).json({
                    message: "OK",
                    data: tasks
                });
            });
        }
    });

    // POST /api/tasks - Create a new task
    tasksRoute.post(function (req, res) {
        // Validate required fields
        if (!req.body.name || !req.body.deadline) {
            return res.status(400).json({
                message: "Bad Request: Name and deadline are required",
                data: {}
            });
        }

        // If assignedUser is provided, validate that the user exists
        var validatedUserName = null;
        if (req.body.assignedUser && req.body.assignedUser !== "") {
            User.findById(req.body.assignedUser, function (err, user) {
                if (err || !user) {
                    return res.status(404).json({
                        message: "User not found",
                        data: {}
                    });
                }

                // User exists, capture their name and proceed with task creation
                validatedUserName = user.name;
                createTask();
            });
        } else {
            // No assignedUser, proceed with task creation
            createTask();
        }

        function createTask() {
            // Create a new task
            var task = new Task();
            task.name = req.body.name;
            task.deadline = req.body.deadline;

            // Set optional fields if provided
            if (req.body.description) {
                task.description = req.body.description;
            }
            if (req.body.completed !== undefined) {
                task.completed = req.body.completed;
            }
            if (req.body.assignedUser) {
                task.assignedUser = req.body.assignedUser;
                // Always use the validated user's actual name, not what the client sends
                task.assignedUserName = validatedUserName;
            }

            // Save the task
            task.save(function (err, savedTask) {
                if (err) {
                    return res.status(500).json({
                        message: "Internal Server Error",
                        data: {}
                    });
                }

                // If task is assigned to a user and not completed, add to user's pendingTasks
                if (savedTask.assignedUser && savedTask.assignedUser !== "" && !savedTask.completed) {
                    User.findById(savedTask.assignedUser, function (err, user) {
                        if (!err && user) {
                            if (user.pendingTasks.indexOf(savedTask._id.toString()) === -1) {
                                user.pendingTasks.push(savedTask._id.toString());
                                user.save(function (err) {});
                            }
                        }
                    });
                }

                res.status(201).json({
                    message: "Task created successfully",
                    data: savedTask
                });
            });
        }
    });

    var taskIdRoute = router.route('/tasks/:id');

    // GET /api/tasks/:id - Get a specific task by ID
    taskIdRoute.get(function (req, res) {
        var query = Task.findById(req.params.id);

        // Apply 'select' if provided
        if (req.query.select) {
            try {
                var selectFields = JSON.parse(req.query.select);
                query = query.select(selectFields);
            } catch (e) {
                return res.status(400).json({
                    message: "Bad Request: Invalid JSON in 'select' parameter",
                    data: {}
                });
            }
        }

        query.exec(function (err, task) {
            if (err) {
                // Handle invalid ObjectId format as 404
                return res.status(404).json({
                    message: "Task not found",
                    data: {}
                });
            }

            if (!task) {
                return res.status(404).json({
                    message: "Task not found",
                    data: {}
                });
            }

            res.status(200).json({
                message: "OK",
                data: task
            });
        });
    });

    // PUT /api/tasks/:id - Update a task by ID
    taskIdRoute.put(function (req, res) {
        // Validate required fields
        if (!req.body.name || !req.body.deadline) {
            return res.status(400).json({
                message: "Bad Request: Name and deadline are required",
                data: {}
            });
        }

        // If assignedUser is provided, validate that the user exists
        var validatedUserName = null;
        if (req.body.assignedUser && req.body.assignedUser !== "") {
            User.findById(req.body.assignedUser, function (err, user) {
                if (err || !user) {
                    return res.status(404).json({
                        message: "User not found",
                        data: {}
                    });
                }

                // User exists, capture their name and proceed with update
                validatedUserName = user.name;
                updateTask();
            });
        } else {
            // No assignedUser or empty string, proceed with update
            updateTask();
        }

        function updateTask() {
            Task.findById(req.params.id, function (err, task) {
                if (err) {
                    return res.status(404).json({
                        message: "Task not found",
                        data: {}
                    });
                }

                if (!task) {
                    return res.status(404).json({
                        message: "Task not found",
                        data: {}
                    });
                }

            // Store old values
            var oldAssignedUser = task.assignedUser || "";
            var oldCompleted = task.completed || false;

            // Update task fields
            task.name = req.body.name;
            task.description = req.body.description || "";
            task.deadline = req.body.deadline;
            task.completed = req.body.completed !== undefined ? req.body.completed : false;
            task.assignedUser = req.body.assignedUser || "";
            // Always use the validated user's actual name, not what the client sends
            task.assignedUserName = validatedUserName || "unassigned";

            var newAssignedUser = task.assignedUser;
            var newCompleted = task.completed;

            // Save the updated task
            task.save(function (err, updatedTask) {
                if (err) {
                    return res.status(500).json({
                        message: "Internal Server Error",
                        data: {}
                    });
                }

                // Handle two-way reference updates
                var taskId = req.params.id;

                // Case 1: AssignedUser changed
                if (oldAssignedUser !== newAssignedUser) {
                    // Remove from old user's pendingTasks
                    if (oldAssignedUser && oldAssignedUser !== "") {
                        User.findById(oldAssignedUser, function (err, oldUser) {
                            if (!err && oldUser) {
                                oldUser.pendingTasks = oldUser.pendingTasks.filter(function(id) {
                                    return id !== taskId;
                                });
                                oldUser.save(function (err) {});
                            }
                        });
                    }

                    // Add to new user's pendingTasks (only if not completed)
                    if (newAssignedUser && newAssignedUser !== "" && !newCompleted) {
                        User.findById(newAssignedUser, function (err, newUser) {
                            if (!err && newUser) {
                                if (newUser.pendingTasks.indexOf(taskId) === -1) {
                                    newUser.pendingTasks.push(taskId);
                                    newUser.save(function (err) {});
                                }
                            }
                        });
                    }
                }
                // Case 2: AssignedUser same, but completion status changed
                else if (oldCompleted !== newCompleted && newAssignedUser && newAssignedUser !== "") {
                    User.findById(newAssignedUser, function (err, user) {
                        if (!err && user) {
                            if (newCompleted) {
                                // Task became completed, remove from pendingTasks
                                user.pendingTasks = user.pendingTasks.filter(function(id) {
                                    return id !== taskId;
                                });
                            } else {
                                // Task became incomplete, add to pendingTasks
                                if (user.pendingTasks.indexOf(taskId) === -1) {
                                    user.pendingTasks.push(taskId);
                                }
                            }
                            user.save(function (err) {});
                        }
                    });
                }

                res.status(200).json({
                    message: "Task updated successfully",
                    data: updatedTask
                });
            });
            });
        }
    });

    // DELETE /api/tasks/:id - Delete a task by ID
    taskIdRoute.delete(function (req, res) {
        Task.findById(req.params.id, function (err, task) {
            if (err) {
                // Handle invalid ObjectId format as 404
                return res.status(404).json({
                    message: "Task not found",
                    data: {}
                });
            }

            if (!task) {
                return res.status(404).json({
                    message: "Task not found",
                    data: {}
                });
            }

            // If task is assigned to a user, remove it from their pendingTasks
            if (task.assignedUser && task.assignedUser !== "") {
                User.findById(task.assignedUser, function (err, user) {
                    if (!err && user) {
                        // Remove the task ID from the user's pendingTasks array
                        user.pendingTasks = user.pendingTasks.filter(function(taskId) {
                            return taskId !== req.params.id;
                        });
                        user.save(function (err) {
                            // Continue with deletion even if user update fails
                        });
                    }

                    // Delete the task
                    Task.findByIdAndRemove(req.params.id, function (err, deletedTask) {
                        if (err) {
                            return res.status(500).json({
                                message: "Internal Server Error",
                                data: {}
                            });
                        }

                        res.status(200).json({
                            message: "Task deleted successfully",
                            data: deletedTask
                        });
                    });
                });
            } else {
                // Task is not assigned, just delete it
                Task.findByIdAndRemove(req.params.id, function (err, deletedTask) {
                    if (err) {
                        return res.status(500).json({
                            message: "Internal Server Error",
                            data: {}
                        });
                    }

                    res.status(200).json({
                        message: "Task deleted successfully",
                        data: deletedTask
                    });
                });
            }
        });
    });

    return router;
}
