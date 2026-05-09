const socket = io("/flow", {

    transports: ["polling", "websocket"],

    withCredentials: true

});
const messagesDiv = document.getElementById("messages");

function add(msg){

const div = document.createElement("div");
div.className = "msg";

if(msg.type === "text"){

div.classList.add("me");
div.innerText = msg.text;

}else{

div.innerHTML = `
<a href="${msg.url}" target="_blank">
📁 ${msg.name}
</a>
`;

}

messagesDiv.appendChild(div);

messagesDiv.scrollTop =
messagesDiv.scrollHeight;

}

socket.on("history",(msgs)=>{
msgs.forEach(add);
});

socket.on("new",add);

function send(){

const input =
document.getElementById("input");

if(!input.value.trim()) return;

socket.emit("send",{
type:"text",
text:input.value
});

input.value="";

}

const drop =
document.getElementById("drop");

drop.addEventListener("dragover",(e)=>{
e.preventDefault();
});

drop.addEventListener("drop",async(e)=>{

e.preventDefault();

const file =
e.dataTransfer.files[0];

if(!file) return;

const formData =
new FormData();

formData.append("file",file);

await fetch("/flow/upload",{
method:"POST",
body:formData
});

});