const filesDiv =
document.getElementById("files");

const fileInput =
document.getElementById("fileInput");

const drop =
document.getElementById("drop");

/* LOAD FILES */

async function loadFiles(){

const res =
await fetch("/files/list");

const data =
await res.json();

filesDiv.innerHTML="";

Object.entries(data).reverse().forEach(([id,file])=>{

const link =
location.origin + "/files/f/" + id;

const ext =
file.originalName.split(".").pop().toUpperCase();

const div =
document.createElement("div");

div.className="file";

div.innerHTML=`

<div class="file-left">

<div class="icon">
${ext}
</div>

<div>

<div class="file-name">
${file.originalName}
</div>

<div class="file-downloads">
${file.downloads || 0} téléchargements
</div>

</div>

</div>

<div class="actions">

<button onclick="copyLink('${link}')">
🔗
</button>

<button onclick="downloadFile('${link}')">
⬇
</button>

<button onclick="deleteFile('${id}')">
🗑
</button>

</div>

`;

filesDiv.appendChild(div);

});

}

/* UPLOAD */

async function uploadFile(file){

const formData =
new FormData();

formData.append("file",file);

await fetch("/files/upload",{
method:"POST",
body:formData
});

loadFiles();

}

/* INPUT */

fileInput.addEventListener("change",(e)=>{

uploadFile(e.target.files[0]);

});

/* DROP */

drop.addEventListener("dragover",(e)=>{
e.preventDefault();
drop.classList.add("drag");
});

drop.addEventListener("dragleave",()=>{
drop.classList.remove("drag");
});

drop.addEventListener("drop",async(e)=>{

e.preventDefault();

drop.classList.remove("drag");

const file =
e.dataTransfer.files[0];

if(!file) return;

uploadFile(file);

});

/* COPY */

function copyLink(link){

navigator.clipboard.writeText(link);

alert("Lien copié !");

}

/* DOWNLOAD */

function downloadFile(link){

window.open(link,"_blank");

}

/* DELETE */

async function deleteFile(id){

await fetch("/files/delete/" + id,{
method:"DELETE"
});

loadFiles();

}

/* START */

loadFiles();