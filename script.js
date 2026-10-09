// =========================================
// GUIA HARMÔNICO - SISTEMA DE LOGIN & DASHBOARD
// =========================================

// =========================================
// CONFIGURAÇÃO SUPABASE
// =========================================
const SUPABASE_URL = "https://clqabiypqovjiuhhzpvi.supabase.co";
const SUPABASE_KEY = "sb_publishable_f3wqjTiwNUz80GsTEusZQw_TUKLHC_2";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// =========================================
// UTILITÁRIOS
// =========================================
function normalizarTexto(texto) {
    if (!texto) return "";
    return texto
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function formatarData(dataIso) {
    if (!dataIso) return "Sem prazo";
    const partes = dataIso.split("-");
    if (partes.length !== 3) return dataIso;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function escaparHTML(texto) {
    if (texto === null || texto === undefined) return "";
    return String(texto)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeQuotes(texto) {
    if (!texto) return "";
    return String(texto).replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

// Recarrega os dados do aluno ativo no painel do professor ou no dashboard do aluno
async function recarregarDadosAtuais() {
    const alunoId = localStorage.getItem("guiaHarmonico_alunoSelecionado");
    if (alunoId && window.location.pathname.toLowerCase().includes("aluno-professor.html")) {
        await carregarDadosAlunoProfessor(alunoId);
    } else {
        await carregarDashboard();
    }
}

// =========================================
// LOGIN & SESSÃO
// =========================================
async function fazerLogin(login, senha) {
    const loginNormalizado = normalizarTexto(login);
    const senhaNormalizada = normalizarTexto(senha);

    const { data, error } = await supabaseClient.rpc("fazer_login", {
        p_login: loginNormalizado,
        p_senha: senhaNormalizada
    });

    if (error) {
        console.error("Erro no login:", error);
        throw new Error("Não foi possível realizar o login.");
    }

    if (!data || data.length === 0) {
        throw new Error("Nome ou senha incorretos.");
    }

    const usuario = data[0];
    localStorage.setItem("guiaHarmonico_usuario", JSON.stringify(usuario));

    return usuario;
}

function obterUsuarioLogado() {
    const usuario = localStorage.getItem("guiaHarmonico_usuario");
    if (!usuario) return null;

    try {
        return JSON.parse(usuario);
    } catch {
        localStorage.removeItem("guiaHarmonico_usuario");
        return null;
    }
}

function sair() {
    localStorage.removeItem("guiaHarmonico_usuario");
    window.location.href = "index.html";
}

// =========================================
// FORMULÁRIO DE LOGIN
// =========================================
const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const login = document.getElementById("login").value;
        const senha = document.getElementById("senha").value;
        const mensagem = document.getElementById("mensagem");

        mensagem.textContent = "Entrando...";

        try {
            const usuario = await fazerLogin(login, senha);
            console.log("Login realizado:", usuario);
            mensagem.textContent = `Olá, ${usuario.nome}!`;

            setTimeout(() => {
                if (usuario.tipo === "professor") {
                    window.location.href = "professor.html";
                } else {
                    window.location.href = "dashboard.html";
                }
            }, 500);
        } catch (erro) {
            console.error(erro);
            mensagem.textContent = erro.message;
        }
    });
}

// =========================================
// CONSULTAS AO SUPABASE (ALUNO)
// =========================================
async function buscarTarefasPorUsuario(usuarioId) {
    const { data, error } = await supabaseClient.rpc("buscar_tarefas_aluno", {
        p_aluno_id: usuarioId
    });

    if (error) {
        console.error("Erro ao buscar tarefas:", error);
        return [];
    }
    return data || [];
}

async function buscarAnotacoesPorUsuario(usuarioId) {
    const { data, error } = await supabaseClient.rpc("buscar_anotacoes_aluno", {
        p_aluno_id: usuarioId
    });

    if (error) {
        console.error("Erro ao buscar anotações:", error);
        return [];
    }
    return data || [];
}

async function buscarRepertorioPorUsuario(usuarioId) {
    const { data, error } = await supabaseClient
        .from("repertorio")
        .select("*")
        .eq("aluno_id", usuarioId)
        .order("criado_em", { ascending: false });

    if (error) {
        console.error("Erro ao buscar repertório:", error);
        return [];
    }
    return data || [];
}

// =========================================
// RENDERIZAÇÃO PARA DASHBOARD DO ALUNO
// =========================================
function mostrarTarefas(listaTarefas) {
    const container = document.getElementById('listaTarefas') || document.getElementById('tarefasAlunoProfessor');
    if (!container) return;

    if (!listaTarefas || listaTarefas.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.8125rem;">Nenhuma tarefa pendente no momento!</p>';
        return;
    }

    container.innerHTML = listaTarefas.map(t => `
        <article class="tarefa">
            <h3>${escaparHTML(t.titulo)}</h3>
            <p style="white-space: pre-wrap;">${escaparHTML(t.descricao || 'Sem descrição.')}</p>
            <small>Prazo: ${t.prazo ? formatarData(t.prazo) : 'Sem prazo'}</small>
            <button type="button" onclick="concluirTarefa('${t.id}')">
                Marcar como concluída
            </button>
        </article>
    `).join('');
}

function mostrarTarefasConcluidas(listaConcluidas) {
    const container = document.getElementById('listaTarefasConcluidas');
    const elemBadge = document.getElementById('quantidadeTarefasConcluidas');
    
    if (elemBadge) elemBadge.textContent = listaConcluidas ? listaConcluidas.length : 0;
    if (!container) return;

    if (!listaConcluidas || listaConcluidas.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.8125rem;">Nenhuma atividade concluída ainda.</p>';
        return;
    }

    container.innerHTML = listaConcluidas.map(t => `
        <article class="tarefa" style="opacity: 0.75; border-left: 3px solid #10B981;">
            <h3 style="text-decoration: line-through;">${escaparHTML(t.titulo)}</h3>
            <p style="white-space: pre-wrap;">${escaparHTML(t.descricao || 'Sem descrição.')}</p>
            <small>✅ Concluída</small>
        </article>
    `).join('');
}

function alternarTarefasConcluidas() {
    const container = document.getElementById('containerTarefasConcluidas');
    const icone = document.getElementById('iconeSanfona');

    if (container.style.display === 'none' || container.style.display === '') {
        container.style.display = 'block';
        icone.textContent = '▲';
    } else {
        container.style.display = 'none';
        icone.textContent = '▼';
    }
}

function mostrarAnotacoes(listaAnotacoes) {
    const container = document.getElementById('listaAnotacoes') || document.getElementById('anotacoesAlunoProfessor');
    if (!container) return;

    if (!listaAnotacoes || listaAnotacoes.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.8125rem;">Nenhuma anotação cadastrada.</p>';
        return;
    }

    container.innerHTML = listaAnotacoes.map(a => {
        const pdfLink = a.arquivo_url
            ? `<p><a href="${escaparHTML(a.arquivo_url)}" target="_blank" rel="noopener noreferrer" style="color: var(--brand-primary); font-size: 0.8125rem;">📎 Abrir arquivo</a></p>`
            : '';

        return `
            <article class="anotacao">
                <h3>${escaparHTML(a.titulo)}</h3>
                <p style="white-space: pre-wrap;">${escaparHTML(a.conteudo || 'Sem observações.')}</p>
                ${pdfLink}
                <button type="button" onclick="concluirAnotacao('${a.id}')">
                    ✅ Marcar como lida/concluída
                </button>
            </article>
        `;
    }).join('');
}

function mostrarRepertorio(listaRepertorio) {
    const container = document.getElementById('listaRepertorio') || document.getElementById('repertorioAlunoProfessor');
    if (!container) return;

    if (!listaRepertorio || listaRepertorio.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.8125rem;">Nenhum repertório cadastrado.</p>';
        return;
    }

    container.innerHTML = listaRepertorio.map(r => `
        <article class="repertorio">
            <h3>${escaparHTML(r.titulo)} ${r.tom ? `<span style="color: var(--brand-primary); font-size: 0.8rem;">(${escaparHTML(r.tom)})</span>` : ''}</h3>
            ${r.artista ? `<p><strong>Artista:</strong> ${escaparHTML(r.artista)}</p>` : ''}
            ${r.cifra ? `<a href="${escaparHTML(r.cifra)}" target="_blank" rel="noopener noreferrer" class="btn-cifra" style="display: inline-flex; align-items: center; gap: 6px; background-color: var(--brand-surface); color: var(--brand-primary); border: 1px solid rgba(217, 119, 6, 0.4); padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.8125rem; font-weight: 600; text-decoration: none; margin-top: 0.5rem;">Cifra</a>` : ''}
        </article>
    `).join('');
}

// =========================================
// AÇÕES DO ALUNO
// =========================================
async function concluirTarefa(tarefaId) {
    const usuario = obterUsuarioLogado();

    if (!usuario) {
        alert("Usuário não encontrado.");
        window.location.href = "index.html";
        return;
    }

    const { data, error } = await supabaseClient.rpc("concluir_tarefa", {
        p_tarefa_id: tarefaId,
        p_aluno_id: usuario.id
    });

    if (error) {
        console.error("Erro ao concluir tarefa:", error);
        alert("Não foi possível concluir a tarefa.");
        return;
    }

    // Recarrega o dashboard para mover a tarefa para a aba de concluídas
    await carregarDashboard();
}

async function concluirAnotacao(anotacaoId) {
    const usuario = obterUsuarioLogado();

    if (!usuario) {
        alert("Usuário não encontrado.");
        window.location.href = "index.html";
        return;
    }

    const { data, error } = await supabaseClient.rpc("concluir_anotacao", {
        p_anotacao_id: anotacaoId,
        p_aluno_id: usuario.id
    });

    if (error) {
        console.error("Erro ao concluir anotação:", error);
        alert("Não foi possível marcar a anotação como concluída.");
        return;
    }

    const anotacoes = await buscarAnotacoesPorUsuario(usuario.id);
    mostrarAnotacoes(anotacoes);
}

// =========================================
// CARREGAR DASHBOARD DO ALUNO
// =========================================
async function carregarDashboard() {
    const usuario = obterUsuarioLogado();

    if (!usuario) {
        window.location.href = "index.html";
        return;
    }

    const nomeUsuario = document.getElementById("nomeUsuario");
    const nomeAluno = document.getElementById("nomeAluno");

    if (nomeUsuario) nomeUsuario.textContent = usuario.nome;
    if (nomeAluno) nomeAluno.textContent = usuario.nome;

    const [tarefas, anotacoes, repertorio] = await Promise.all([
        buscarTarefasPorUsuario(usuario.id),
        buscarAnotacoesPorUsuario(usuario.id),
        buscarRepertorioPorUsuario(usuario.id)
    ]);

    const tarefasPendentes = tarefas.filter(tarefa => !tarefa.concluida);
    const tarefasConcluidas = tarefas.filter(tarefa => tarefa.concluida);

    const elemTarefas = document.getElementById("quantidadeTarefas");
    const elemAnotacoes = document.getElementById("quantidadeAnotacoes");
    const elemRepertorio = document.getElementById("quantidadeRepertorio");

    if (elemTarefas) elemTarefas.textContent = tarefasPendentes.length;
    if (elemAnotacoes) elemAnotacoes.textContent = anotacoes.length;
    if (elemRepertorio) elemRepertorio.textContent = repertorio.length;

    mostrarTarefas(tarefasPendentes);
    mostrarTarefasConcluidas(tarefasConcluidas);
    mostrarAnotacoes(anotacoes);
    mostrarRepertorio(repertorio);
}

// =========================================
// PROFESSOR
// =========================================
async function buscarAlunos() {
    const { data, error } = await supabaseClient.rpc("buscar_alunos");

    if (error) {
        console.error("Erro ao buscar alunos:", error);
        return [];
    }
    return data || [];
}

function mostrarAlunos(alunos) {
    const lista = document.getElementById("listaAlunos");
    if (!lista) return;

    if (alunos.length === 0) {
        lista.innerHTML = `<p>Nenhum aluno cadastrado.</p>`;
        return;
    }

    lista.innerHTML = alunos.map(aluno => `
        <article class="aluno">
            <h3>${escaparHTML(aluno.nome)}</h3>
            <button type="button" onclick="abrirAluno('${aluno.id}')">Abrir aluno</button>
        </article>
    `).join("");
}

function abrirAluno(alunoId) {
    localStorage.setItem("guiaHarmonico_alunoSelecionado", alunoId);
    window.location.href = "aluno-professor.html";
}

async function carregarProfessor() {
    const usuario = obterUsuarioLogado();

    if (!usuario) {
        window.location.href = "index.html";
        return;
    }

    if (usuario.tipo !== "professor") {
        window.location.href = "dashboard.html";
        return;
    }

    const nomeProfessor = document.getElementById("nomeProfessor");
    const nomeProfessorPrincipal = document.getElementById("nomeProfessorPrincipal");

    if (nomeProfessor) nomeProfessor.textContent = usuario.nome;
    if (nomeProfessorPrincipal) nomeProfessorPrincipal.textContent = usuario.nome;

    const alunos = await buscarAlunos();
    mostrarAlunos(alunos);
}

// =========================================
// VISUALIZAÇÃO DO ALUNO (ÁREA PROFESSOR)
// =========================================
async function carregarAlunoProfessor() {
    const professor = obterUsuarioLogado();

    if (!professor) {
        window.location.href = "index.html";
        return;
    }

    if (professor.tipo !== "professor") {
        window.location.href = "dashboard.html";
        return;
    }

    const alunoId = localStorage.getItem("guiaHarmonico_alunoSelecionado");

    if (!alunoId) {
        window.location.href = "professor.html";
        return;
    }

    const nomeProfessor = document.getElementById("nomeProfessor");
    if (nomeProfessor) nomeProfessor.textContent = professor.nome;

    const { data, error } = await supabaseClient.rpc("buscar_aluno_professor", {
        p_aluno_id: alunoId
    });

    if (error || !data || data.length === 0) {
        console.error("Erro ao buscar aluno:", error);
        alert("Aluno não encontrado ou erro ao carregar.");
        window.location.href = "professor.html";
        return;
    }

    const aluno = data[0];

    const elemNome = document.getElementById("nomeAlunoProfessor");
    const elemLogin = document.getElementById("loginAlunoProfessor");

    if (elemNome) elemNome.textContent = aluno.nome;
    if (elemLogin) elemLogin.textContent = `Login: ${aluno.login}`;

    carregarDadosAlunoProfessor(alunoId);
}

async function carregarDadosAlunoProfessor(alunoId) {
    console.log("Carregando dados do aluno para vista do professor:", alunoId);

    // 1. Tarefas
    const tarefas = await buscarTarefasPorUsuario(alunoId);
    const listaTarefas = document.getElementById("tarefasAlunoProfessor");

    if (listaTarefas) {
        if (tarefas.length === 0) {
            listaTarefas.innerHTML = `<p style="color: var(--text-muted); font-size: 0.8125rem;">Nenhuma tarefa cadastrada.</p>`;
        } else {
            listaTarefas.innerHTML = tarefas.map(t => `
                <article>
                    <h3>${escaparHTML(t.titulo)}</h3>
                    <p style="white-space: pre-wrap;">${escaparHTML(t.descricao || "Sem descrição.")}</p>
                    <small>📅 Prazo: ${formatarData(t.prazo)} | Status: ${t.concluida ? "✅ Concluída" : "⏳ Pendente"}</small>
                    
                    <div class="card-actions">
                        <button class="btn-card-edit" onclick="abrirModalEditarTarefa('${t.id}', \`${escapeQuotes(t.titulo)}\`, \`${escapeQuotes(t.descricao || '')}\`, '${t.prazo || ''}')">
                            Editar
                        </button>
                        <button class="btn-card-delete" onclick="excluirItem('tarefas', '${t.id}')">
                            Excluir
                        </button>
                    </div>
                </article>
            `).join("");
        }
    }

    // 2. Anotações
    const anotacoes = await buscarAnotacoesPorUsuario(alunoId);
    const listaAnotacoes = document.getElementById("anotacoesAlunoProfessor");

    if (listaAnotacoes) {
        if (anotacoes.length === 0) {
            listaAnotacoes.innerHTML = `<p style="color: var(--text-muted); font-size: 0.8125rem;">Nenhuma anotação cadastrada.</p>`;
        } else {
            listaAnotacoes.innerHTML = anotacoes.map(a => {
                const pdfLink = a.arquivo_url
                    ? `<p><a href="${escaparHTML(a.arquivo_url)}" target="_blank" rel="noopener noreferrer" style="color: var(--brand-primary); font-size: 0.8125rem;">📎 Abrir arquivo</a></p>`
                    : '';

                return `
                    <article>
                        <h3>${escaparHTML(a.titulo)}</h3>
                        <p style="white-space: pre-wrap;">${escaparHTML(a.conteudo || "Sem observações.")}</p>
                        ${pdfLink}
                        <small>Status: ${a.concluida ? "✅ Concluída" : "⏳ Pendente"}</small>

                        <div class="card-actions">
                            <button class="btn-card-edit" onclick="abrirModalEditarAnotacao('${a.id}', \`${escapeQuotes(a.titulo)}\`, \`${escapeQuotes(a.conteudo || '')}\`, \`${escapeQuotes(a.arquivo_url || '')}\`)">
                                Editar
                            </button>
                            <button class="btn-card-delete" onclick="excluirItem('anotacoes', '${a.id}')">
                                Excluir
                            </button>
                        </div>
                    </article>
                `;
            }).join("");
        }
    }

    // 3. Repertório
    const repertorio = await buscarRepertorioPorUsuario(alunoId);
    const listaRepertorio = document.getElementById("repertorioAlunoProfessor");

    if (listaRepertorio) {
        if (repertorio.length === 0) {
            listaRepertorio.innerHTML = `<p style="color: var(--text-muted); font-size: 0.8125rem;">Nenhum repertório cadastrado.</p>`;
        } else {
            listaRepertorio.innerHTML = repertorio.map(r => `
                <article>
                    <h3>${escaparHTML(r.titulo)} ${r.tom ? `<span style="color: var(--brand-primary); font-size: 0.8rem;">(${escaparHTML(r.tom)})</span>` : ''}</h3>
                    <p><strong>Artista:</strong> ${escaparHTML(r.artista || 'Não informado')}</p>
                    ${r.cifra ? `<pre style="background: var(--bg-body); padding: 8px; border-radius: 4px; color: var(--text-secondary); font-size: 0.75rem; white-space: pre-wrap;">${escaparHTML(r.cifra)}</pre>` : ''}
                    
                    <div class="card-actions">
                        <button class="btn-card-edit" onclick="abrirModalEditarRepertorio('${r.id}', \`${escapeQuotes(r.titulo)}\`, \`${escapeQuotes(r.artista || '')}\`, \`${escapeQuotes(r.tom || '')}\`, \`${escapeQuotes(r.cifra || '')}\`)">
                            Editar
                        </button>
                        <button class="btn-card-delete" onclick="excluirItem('repertorio', '${r.id}')">
                            Excluir
                        </button>
                    </div>
                </article>
            `).join("");
        }
    }
}

// =========================================
// GERENCIAMENTO DE MODAIS E CRIAÇÃO
// =========================================
function configurarModaisProfessor() {
    const modalTarefa = document.getElementById("modalTarefa");
    const modalAnotacao = document.getElementById("modalAnotacao");
    const modalRepertorio = document.getElementById("modalRepertorio");

    // Abrir Modais
    document.getElementById("botaoNovaTarefa")?.addEventListener("click", () => modalTarefa?.showModal());
    document.getElementById("botaoNovaAnotacao")?.addEventListener("click", () => modalAnotacao?.showModal());
    document.getElementById("botaoNovoRepertorio")?.addEventListener("click", () => modalRepertorio?.showModal());

    // Botões de Cancelar/Fechar Modais
    document.querySelectorAll(".btnFecharModal").forEach(botao => {
        botao.addEventListener("click", (e) => {
            const modal = e.target.closest("dialog");
            if (modal) modal.close();
        });
    });

    // Submit: Nova Tarefa
    document.getElementById("formNovaTarefa")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const alunoId = localStorage.getItem("guiaHarmonico_alunoSelecionado");
        if (!alunoId) return;

        const titulo = document.getElementById("tarefaTitulo").value;
        const descricao = document.getElementById("tarefaDescricao").value;
        const prazo = document.getElementById("tarefaPrazo").value || null;

        const { error } = await supabaseClient.rpc("criar_tarefa", {
            p_aluno_id: alunoId,
            p_titulo: titulo,
            p_descricao: descricao,
            p_prazo: prazo
        });

        if (error) {
            console.error("Erro ao criar tarefa:", error);
            alert("Erro ao criar tarefa: " + error.message);
        } else {
            e.target.reset();
            modalTarefa?.close();
            carregarDadosAlunoProfessor(alunoId);
        }
    });

    // Submit: Nova Anotação
    document.getElementById("formNovaAnotacao")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const alunoId = localStorage.getItem("guiaHarmonico_alunoSelecionado");
        if (!alunoId) return;

        const titulo = document.getElementById("anotacaoTitulo").value;
        const conteudo = document.getElementById("anotacaoConteudo").value;
        const arquivoUrl = document.getElementById("anotacaoUrl").value || null;

        const { error } = await supabaseClient.from("anotacoes").insert([{
            aluno_id: alunoId,
            titulo: titulo,
            conteudo: conteudo,
            arquivo_url: arquivoUrl,
            concluida: false
        }]);

        if (error) {
            console.error("Erro ao criar anotação:", error);
            alert("Erro ao criar anotação: " + error.message);
        } else {
            e.target.reset();
            modalAnotacao?.close();
            carregarDadosAlunoProfessor(alunoId);
        }
    });

    // Submit: Novo Repertório
    document.getElementById("formNovoRepertorio")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const alunoId = localStorage.getItem("guiaHarmonico_alunoSelecionado");
        if (!alunoId) return;

        const titulo = document.getElementById("repertorioTitulo").value;
        const artista = document.getElementById("repertorioArtista").value;
        const tom = document.getElementById("repertorioTom").value;
        const cifra = document.getElementById("repertorioCifra").value;

        const { error } = await supabaseClient.from("repertorio").insert([{
            aluno_id: alunoId,
            titulo: titulo,
            artista: artista,
            tom: tom,
            cifra: cifra
        }]);

        if (error) {
            console.error("Erro ao adicionar repertório:", error);
            alert("Erro ao adicionar repertório: " + error.message);
        } else {
            e.target.reset();
            modalRepertorio?.close();
            carregarDadosAlunoProfessor(alunoId);
        }
    });
}

// ==========================================
// ABRIR MODAIS DE EDIÇÃO
// ==========================================
function abrirModalEditarTarefa(id, titulo, descricao, prazo) {
    document.getElementById('editTarefaId').value = id;
    document.getElementById('editTarefaTitulo').value = titulo;
    document.getElementById('editTarefaDescricao').value = descricao;
    document.getElementById('editTarefaPrazo').value = prazo;
    document.getElementById('modalEditarTarefa').showModal();
}

function abrirModalEditarAnotacao(id, titulo, conteudo, url) {
    document.getElementById('editAnotacaoId').value = id;
    document.getElementById('editAnotacaoTitulo').value = titulo;
    document.getElementById('editAnotacaoConteudo').value = conteudo;
    document.getElementById('editAnotacaoUrl').value = url;
    document.getElementById('modalEditarAnotacao').showModal();
}

function abrirModalEditarRepertorio(id, titulo, artista, tom, cifra) {
    document.getElementById('editRepertorioId').value = id;
    document.getElementById('editRepertorioTitulo').value = titulo;
    document.getElementById('editRepertorioArtista').value = artista;
    document.getElementById('editRepertorioTom').value = tom;
    document.getElementById('editRepertorioCifra').value = cifra;
    document.getElementById('modalEditarRepertorio').showModal();
}

// ==========================================
// SUBMITS DOS FORMULÁRIOS DE EDIÇÃO
// ==========================================
document.getElementById('formEditarTarefa')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editTarefaId').value;
    const updateData = {
        titulo: document.getElementById('editTarefaTitulo').value,
        descricao: document.getElementById('editTarefaDescricao').value,
        prazo: document.getElementById('editTarefaPrazo').value || null
    };

    const { error } = await supabaseClient.from('tarefas').update(updateData).eq('id', id);
    if (error) return alert('Erro ao atualizar: ' + error.message);
    
    document.getElementById('modalEditarTarefa').close();
    await recarregarDadosAtuais();
});

document.getElementById('formEditarAnotacao')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editAnotacaoId').value;
    const updateData = {
        titulo: document.getElementById('editAnotacaoTitulo').value,
        conteudo: document.getElementById('editAnotacaoConteudo').value,
        arquivo_url: document.getElementById('editAnotacaoUrl').value || null
    };

    const { error } = await supabaseClient.from('anotacoes').update(updateData).eq('id', id);
    if (error) return alert('Erro ao atualizar: ' + error.message);

    document.getElementById('modalEditarAnotacao').close();
    await recarregarDadosAtuais();
});

document.getElementById('formEditarRepertorio')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editRepertorioId').value;
    const updateData = {
        titulo: document.getElementById('editRepertorioTitulo').value,
        artista: document.getElementById('editRepertorioArtista').value,
        tom: document.getElementById('editRepertorioTom').value,
        cifra: document.getElementById('editRepertorioCifra').value
    };

    const { error } = await supabaseClient.from('repertorio').update(updateData).eq('id', id);
    if (error) return alert('Erro ao atualizar: ' + error.message);

    document.getElementById('modalEditarRepertorio').close();
    await recarregarDadosAtuais();
});

// ==========================================
// FUNÇÃO ÚNICA DE EXCLUSÃO
// ==========================================
async function excluirItem(tabela, id) {
    if (!confirm('Deseja realmente excluir este item?')) return;

    try {
        const { data, error } = await supabaseClient
            .from(tabela)
            .delete()
            .eq('id', id)
            .select();

        if (error) {
            console.error(`Erro ao excluir de ${tabela}:`, error);
            alert('Erro ao excluir: ' + error.message);
            return;
        }

        if (!data || data.length === 0) {
            alert('Atenção: O item não foi excluído! Verifique as permissões (RLS) no Supabase para a tabela ' + tabela);
            console.warn(`[Supabase RLS Block] Nenhuma linha afetada na tabela '${tabela}' com o ID '${id}'.`);
            return;
        }

        alert('Item excluído com sucesso!');
        await recarregarDadosAtuais();
    } catch (err) {
        console.error("Erro inesperado na exclusão:", err);
        alert("Ocorreu um erro ao tentar excluir o item.");
    }
}

// =========================================
// INICIALIZAÇÃO DE PÁGINAS E EVENTOS
// =========================================
const botaoSair = document.getElementById("botaoSair");
if (botaoSair) {
    botaoSair.addEventListener("click", sair);
}

const path = window.location.pathname.toLowerCase();

if (path.includes("dashboard.html")) {
    carregarDashboard();
} else if (path.includes("aluno-professor.html")) {
    carregarAlunoProfessor();
    configurarModaisProfessor();
} else if (path.includes("professor.html")) {
    carregarProfessor();
}

// =========================================
// CONSTRUTOR DE ACORDES PROFISSIONAL (VIOLÃO & TECLADO 2 OITAVAS)
// =========================================
let modoConstrutorAtual = 'violao';

// Estado do Violão
let posicaoNotasBuilder = [0, 0, 0, 0, 0, 0];
let pestanaBuilder = null;
let isDragging = false;
let dragStart = null;
let dragCurrent = null;

// Estado do Teclado (2 Oitavas: 0 a 23)
let teclasTecladoBuilder = [];

// ALTERNAR ENTRE VIOLÃO E TECLADO
function alternarModoConstrutor(modo) {
    modoConstrutorAtual = modo;

    const btnV = document.getElementById("btnBuildViolao");
    const btnT = document.getElementById("btnBuildTeclado");
    const containerV = document.getElementById("containerBuildViolao");
    const containerT = document.getElementById("containerBuildTeclado");

    if (modo === 'violao') {
        btnV?.classList.add("active");
        btnT?.classList.remove("active");
        if (containerV) containerV.style.display = "block";
        if (containerT) containerT.style.display = "none";
        renderizarBraco12Casas();
    } else {
        btnT?.classList.add("active");
        btnV?.classList.remove("active");
        if (containerT) containerT.style.display = "block";
        if (containerV) containerV.style.display = "none";
        renderizarTecladoInteractive();
    }
}

// RENDERIZADOR DO TECLADO INTERATIVO (2 OITAVAS = 24 TECLAS)
function renderizarTecladoInteractive() {
    const box = document.getElementById("builderTecladoBox");
    if (!box) return;

    // Teclas Brancas (14 teclas nas 2 oitavas)
    const whiteKeys = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23];
    // Teclas Pretas (10 teclas nas 2 oitavas)
    const blackKeys = [1, 3, 6, 8, 10, 13, 15, 18, 20, 22];
    
    // Posições X exatas das teclas pretas
    const blackX = { 
        1: 30, 3: 72, 6: 156, 8: 198, 10: 240, 
        13: 324, 15: 366, 18: 450, 20: 492, 22: 534 
    };

    const keyNames = { 
        0: 'C3', 1: 'C#', 2: 'D', 3: 'D#', 4: 'E', 5: 'F', 6: 'F#', 7: 'G', 8: 'G#', 9: 'A', 10: 'A#', 11: 'B',
        12: 'C4', 13: 'C#', 14: 'D', 15: 'D#', 16: 'E', 17: 'F', 18: 'F#', 19: 'G', 20: 'G#', 21: 'A', 22: 'A#', 23: 'B'
    };

    let wKeysSvg = '';
    whiteKeys.forEach((note, idx) => {
        const isActive = teclasTecladoBuilder.includes(note);
        const fill = isActive ? '#D97706' : '#1F2937'; // Laranja / Dark Surface
        const xPos = idx * 42 + 10;

        wKeysSvg += `
            <g onclick="toggleTeclaTeclado(${note})" style="cursor:pointer;">
                <rect x="${xPos}" y="10" width="38" height="150" rx="4" fill="${fill}" stroke="#374151" stroke-width="1.5"/>
                <text x="${xPos + 19}" y="145" fill="${isActive ? '#FFFFFF' : '#9CA3AF'}" font-size="10" text-anchor="middle" font-weight="bold">${keyNames[note]}</text>
            </g>
        `;
    });

    let bKeysSvg = '';
    blackKeys.forEach((note) => {
        const isActive = teclasTecladoBuilder.includes(note);
        const fill = isActive ? '#F59E0B' : '#111827';
        const xPos = blackX[note];

        bKeysSvg += `
            <g onclick="toggleTeclaTeclado(${note})" style="cursor:pointer;">
                <rect x="${xPos}" y="10" width="24" height="92" rx="3" fill="${fill}" stroke="#000000" stroke-width="1"/>
                <text x="${xPos + 12}" y="85" fill="${isActive ? '#000000' : '#D1D5DB'}" font-size="8" text-anchor="middle" font-weight="bold">${keyNames[note]}</text>
            </g>
        `;
    });

    box.innerHTML = `
        <svg viewBox="0 0 610 170" width="610px" height="170px">
            ${wKeysSvg}
            ${bKeysSvg}
        </svg>
    `;
}

function toggleTeclaTeclado(note) {
    if (teclasTecladoBuilder.includes(note)) {
        teclasTecladoBuilder = teclasTecladoBuilder.filter(n => n !== note);
    } else {
        teclasTecladoBuilder.push(note);
    }
    renderizarTecladoInteractive();
}

// RENDERIZADOR DO VIOLÃO (12 CASAS)
function renderizarBraco12Casas() {
    const box = document.getElementById("builderBracoBox");
    if (!box) return;

    const totalCasas = 12;
    const larguraCasa = 65;
    const offsetInicioX = 50;
    const stringsY = [35, 60, 85, 110, 135, 160];
    const stringNames = ["6ª (E)", "5ª (A)", "4ª (D)", "3ª (G)", "2ª (B)", "1ª (e)"];
    
    const svgLargura = offsetInicioX + (totalCasas * larguraCasa) + 20;

    let svgElements = '';

    stringsY.forEach((y, i) => {
        const temNotaExtra = posicaoNotasBuilder[i] > 0;
        const temPestana = pestanaBuilder && i >= pestanaBuilder.minCorda && i <= pestanaBuilder.maxCorda;
        
        let symbol = 'O';
        let color = '#D97706';

        if (posicaoNotasBuilder[i] === -1) {
            symbol = '✕';
            color = '#EF4444';
        } else if (temNotaExtra || temPestana) {
            symbol = '•';
            color = '#6B7280';
        }

        svgElements += `
            <text x="18" y="${y + 4}" fill="${color}" font-size="14" text-anchor="middle" font-weight="bold" 
                  onclick="alternarMuteCorda(${i})" style="cursor:pointer;">${symbol}</text>
            <text x="34" y="${y + 3}" fill="#6B7280" font-size="9" text-anchor="middle">${stringNames[i]}</text>
        `;
    });

    svgElements += `<rect x="${offsetInicioX - 4}" y="30" width="6" height="135" fill="#D1D5DB" rx="2"/>`;

    for (let c = 1; c <= totalCasas; c++) {
        const xTraste = offsetInicioX + (c * larguraCasa);
        const xCentroCasa = xTraste - (larguraCasa / 2);

        svgElements += `<text x="${xCentroCasa}" y="20" fill="#9CA3AF" font-size="11" text-anchor="middle" font-weight="bold">${c}ª</text>`;
        svgElements += `<line x1="${xTraste}" y1="30" x2="${xTraste}" y2="165" stroke="#374151" stroke-width="2"/>`;

        if ([3, 5, 7, 9, 12].includes(c)) {
            svgElements += `<circle cx="${xCentroCasa}" cy="178" r="3" fill="#D97706" opacity="0.6"/>`;
        }
    }

    stringsY.forEach(y => {
        svgElements += `<line x1="${offsetInicioX}" y1="${y}" x2="${svgLargura - 20}" y2="${y}" stroke="#4B5563" stroke-width="1.5"/>`;
    });

    if (pestanaBuilder) {
        const xCentroCasa = offsetInicioX + (pestanaBuilder.casa * larguraCasa) - (larguraCasa / 2);
        const y1 = stringsY[pestanaBuilder.minCorda];
        const y2 = stringsY[pestanaBuilder.maxCorda];

        svgElements += `
            <rect x="${xCentroCasa - 6}" y="${y1 - 6}" width="12" height="${(y2 - y1) + 12}" rx="6" fill="#D97706" pointer-events="none"/>
        `;
    }

    if (isDragging && dragStart && dragCurrent && dragStart.casa === dragCurrent.casa) {
        const casaNum = dragStart.casa;
        const minCorda = Math.min(dragStart.cordaIdx, dragCurrent.cordaIdx);
        const maxCorda = Math.max(dragStart.cordaIdx, dragCurrent.cordaIdx);

        const xCentroCasa = offsetInicioX + (casaNum * larguraCasa) - (larguraCasa / 2);
        const y1 = stringsY[minCorda];
        const y2 = stringsY[maxCorda];

        svgElements += `
            <rect x="${xCentroCasa - 6}" y="${y1 - 6}" width="12" height="${(y2 - y1) + 12}" rx="6" fill="#D97706" opacity="0.55" pointer-events="none"/>
        `;
    }

    for (let c = 1; c <= totalCasas; c++) {
        const xCentroCasa = offsetInicioX + (c * larguraCasa) - (larguraCasa / 2);

        stringsY.forEach((yCorda, cordaIdx) => {
            const temBolinhaNota = posicaoNotasBuilder[cordaIdx] === c;

            svgElements += `
                <rect x="${xCentroCasa - (larguraCasa / 2)}" y="${yCorda - 10}" 
                      width="${larguraCasa}" height="20" fill="transparent" style="cursor:pointer;"
                      onmousedown="handleMouseDown(event, ${cordaIdx}, ${c})"
                      onmousemove="handleMouseMove(event, ${cordaIdx}, ${c})"
                      onmouseup="handleMouseUp(event, ${cordaIdx}, ${c})"
                />
            `;

            if (temBolinhaNota) {
                svgElements += `<circle cx="${xCentroCasa}" cy="${yCorda}" r="7" fill="#D97706" pointer-events="none"/>`;
            }
        });
    }

    box.innerHTML = `
        <svg viewBox="0 0 ${svgLargura} 190" width="${svgLargura}px" height="190px">
            ${svgElements}
        </svg>
    `;
}

function handleMouseDown(e, cordaIdx, casa) {
    if (e.button !== 0) return;
    isDragging = true;
    dragStart = { cordaIdx, casa };
    dragCurrent = { cordaIdx, casa };
    renderizarBraco12Casas();
}

function handleMouseMove(e, cordaIdx, casa) {
    if (!isDragging) return;
    if (dragCurrent.cordaIdx !== cordaIdx || dragCurrent.casa !== casa) {
        dragCurrent = { cordaIdx, casa };
        renderizarBraco12Casas();
    }
}

function handleMouseUp(e, cordaIdxFinal, casaFinal) {
    if (!isDragging) return;

    if (dragStart.casa === casaFinal) {
        const minCorda = Math.min(dragStart.cordaIdx, cordaIdxFinal);
        const maxCorda = Math.max(dragStart.cordaIdx, cordaIdxFinal);

        if (minCorda === maxCorda) {
            if (posicaoNotasBuilder[minCorda] === casaFinal) {
                posicaoNotasBuilder[minCorda] = 0;
            } else {
                posicaoNotasBuilder[minCorda] = casaFinal;
            }
        } else {
            pestanaBuilder = {
                casa: casaFinal,
                minCorda: minCorda,
                maxCorda: maxCorda
            };
        }
    } else {
        posicaoNotasBuilder[cordaIdxFinal] = casaFinal;
    }

    isDragging = false;
    dragStart = null;
    dragCurrent = null;
    renderizarBraco12Casas();
}

function alternarMuteCorda(cordaIdx) {
    if (posicaoNotasBuilder[cordaIdx] === -1) {
        posicaoNotasBuilder[cordaIdx] = 0;
    } else {
        posicaoNotasBuilder[cordaIdx] = -1;
    }
    renderizarBraco12Casas();
}

function configurarCadastroAcorde() {
    const modalAcorde = document.getElementById("modalAcorde");
    const btnNovoAcorde = document.getElementById("btnNovoAcorde");
    const formNovoAcorde = document.getElementById("formNovoAcorde");

    if (btnNovoAcorde && modalAcorde) {
        btnNovoAcorde.onclick = function () {
            posicaoNotasBuilder = [0, 0, 0, 0, 0, 0];
            pestanaBuilder = null;
            teclasTecladoBuilder = [];
            alternarModoConstrutor('violao');
            modalAcorde.showModal();
        };
    }

    document.getElementById("btnLimparBraco")?.addEventListener("click", () => {
        if (modoConstrutorAtual === 'violao') {
            posicaoNotasBuilder = [0, 0, 0, 0, 0, 0];
            pestanaBuilder = null;
            renderizarBraco12Casas();
        } else {
            teclasTecladoBuilder = [];
            renderizarTecladoInteractive();
        }
    });

   if (formNovoAcorde) {
    formNovoAcorde.onsubmit = async function (e) {
        e.preventDefault();

        const nome = document.getElementById("acordeNome").value.trim();
        const tonica = document.getElementById("acordeTonica").value.trim().toUpperCase();
        const tipo = document.getElementById("acordeTipo").value.trim();

        // 1. Verifica se montou no Violão
        let gFinal = [];
        const temNotasViolao = posicaoNotasBuilder.some(val => val !== 0) || pestanaBuilder !== null;
        
        if (temNotasViolao) {
            gFinal = [0, 0, 0, 0, 0, 0];
            for (let i = 0; i < 6; i++) {
                if (posicaoNotasBuilder[i] !== 0) {
                    gFinal[i] = posicaoNotasBuilder[i];
                } else if (pestanaBuilder && i >= pestanaBuilder.minCorda && i <= pestanaBuilder.maxCorda) {
                    gFinal[i] = pestanaBuilder.casa;
                }
            }
        }

        // 2. Verifica se montou no Teclado
        let kFinal = [];
        if (teclasTecladoBuilder.length > 0) {
            kFinal = [...teclasTecladoBuilder].sort((a, b) => a - b);
        }

        // Validação: Exige que ao menos um dos instrumentos tenha notas marcadas
        if (gFinal.length === 0 && kFinal.length === 0) {
            alert("Monte o acorde no Violão ou no Teclado antes de salvar!");
            return;
        }

        try {
            const { error } = await supabaseClient.from("acordes").insert([{
                nome: nome,
                tonica: tonica,
                tipo: tipo,
                posicao_violao: gFinal,
                posicao_teclado: kFinal
            }]);

            if (error) {
                alert("Erro ao salvar o acorde: " + error.message);
            } else {
                alert("🎉 Acorde cadastrado com sucesso!");
                formNovoAcorde.reset();
                modalAcorde.close();
                if (typeof renderizarGradeAcordes === 'function') renderizarGradeAcordes();
            }
        } catch (err) {
            console.error("Erro inesperado:", err);
        }
    };
}
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", configurarCadastroAcorde);
} else {
    configurarCadastroAcorde();
}