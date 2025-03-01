$(document).ready(function() {
    let token = null;
    let currentProjectId = null;

    $('#login').click(function() {
        const username = $('#username').val();
        const password = $('#password').val();

        $.post('/api/auth/login', { username, password }, function(data) {
            token = data.token;
            $('#login-register').hide();
            $('#dashboard').show();
            loadProjects();
        });
    });

    $('#register').click(function() {
        const username = $('#username').val();
        const password = $('#password').val();

        $.post('/api/auth/register', { username, password }, function(data) {
            alert('Registration successful! Please login.');
        });
    });

    $('#createProject').click(function() {
        const name = prompt('Enter project name:');
        if (name) {
            $.ajax({
                url: '/api/projects',
                type: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                data: { name, user_id: 1 }, // Replace with actual user ID
                success: function(data) {
                    loadProjects();
                }
            });
        }
    });

    $('#testProject').click(function() {
        if (!currentProjectId) {
            alert('Please select a project first.');
            return;
        }

        $.ajax({
            url: `/api/projects/${currentProjectId}/run-tests`,
            type: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            success: function(data) {
                alert('Project tests completed! Check the results.');
                console.log(data); // Log results to the console
                loadTestResults(currentProjectId); // Refresh results view
            },
            error: function(err) {
                alert('Error running project tests: ' + err.responseJSON.error);
                console.error(err);
            }
        });
    });

    function loadProjects() {
        $.ajax({
            url: '/api/projects/1', // Replace with actual user ID
            type: 'GET',
            headers: { 'Authorization': `Bearer ${token}` },
            success: function(data) {
                $('#projects').empty();
                data.forEach(project => {
                    const projectElement = $(`
                        <div>
                            ${project.name}
                            <button class="selectProject" data-id="${project.id}">Select</button>
                            <button class="viewResults" data-id="${project.id}">View Results</button>
                        </div>
                    `);
                    $('#projects').append(projectElement);
                });

                // Add click handler for selecting a project
                $('.selectProject').click(function() {
                    currentProjectId = $(this).data('id');
                    alert(`Selected project ID: ${currentProjectId}`);
                });

                // Add click handler for viewing test results
                $('.viewResults').click(function() {
                    const projectId = $(this).data('id');
                    loadTestResults(projectId);
                });
            }
        });
    }

    function loadTestResults(projectId) {
        $.ajax({
            url: `/api/tests/results?projectId=${projectId}`,
            type: 'GET',
            headers: { 'Authorization': `Bearer ${token}` },
            success: function(data) {
                $('#resultsTable tbody').empty();
                data.forEach(result => {
                    $('#resultsTable tbody').append(`
                        <tr>
                            <td>${result.test_name}</td>
                            <td>${result.status}</td>
                            <td>${JSON.stringify(result.result)}</td>
                            <td>${new Date(result.created_at).toLocaleString()}</td>
                        </tr>
                    `);
                });
            }
        });
    }
});