const tasksDiv =
document.getElementById("tasks");

// =====================
// LOAD TASKS
// =====================

async function loadTasks(){

    const res =
    await fetch("/api/check");

    const tasks =
    await res.json();

    tasksDiv.innerHTML = "";

    tasks.forEach(task => {

        const div =
        document.createElement("div");

        div.className = "task";

        div.innerHTML = `

            <span class="
                ${task.done ? "done" : ""}
            ">
                ${task.text}
            </span>

            <div>

                <button
                    onclick="toggleTask('${task.id}')"
                >
                    ✅
                </button>

                <button
                    onclick="deleteTask('${task.id}')"
                >
                    🗑
                </button>

            </div>

        `;

        tasksDiv.appendChild(div);

    });

}

// =====================
// ADD TASK
// =====================

async function addTask(){

    const input =
    document.getElementById(
        "taskInput"
    );

    const text =
    input.value.trim();

    if(!text) return;

    await fetch("/api/check", {

        method: "POST",

        headers: {
            "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
            text
        })

    });

    input.value = "";

    loadTasks();

}

// =====================
// TOGGLE
// =====================

async function toggleTask(id){

    await fetch(
        "/api/check/" + id,
        {
            method: "PUT"
        }
    );

    loadTasks();

}

// =====================
// DELETE
// =====================

async function deleteTask(id){

    await fetch(
        "/api/check/" + id,
        {
            method: "DELETE"
        }
    );

    loadTasks();

}

loadTasks();