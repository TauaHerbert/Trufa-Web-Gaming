var CONFIG_API = {
  ID_LOCAL: "1",
  FUSO: "America/Recife",
  FUSO_OFFSET_MS: -3 * 60 * 60 * 1000, // UTC-3 fixo (America/Recife)
  CHAVE_CACHE: "dados_site_v2",
  CACHE_SEGUNDOS: 300,
  DURACAO_JOGO: 45,
  CONTAGEM_REGRESSIVA: 6,   // segundos entre liberar o acesso e o jogo começar
  TEMPO_MINIMO: 3,
  FOLGA_REDE: 30,           // tolerância (s) para lentidão de rede
  PRAZO_MAX_SALVAR: 180,
  MAX_TENTATIVAS_PIN: 5,
  BLOQUEIO_PIN_SEGUNDOS: 900,
  TEMPO_PENDENTE: 9999
};
// MOTOR DE LEITURA (Envia dados para o site)
function doGet(e) {
  var cache = CacheService.getScriptCache();
  var json = cache.get(CONFIG_API.CHAVE_CACHE);
  if (json) {
    try {
      var dadosCache = JSON.parse(json);
      var cicloAtual = obterCicloSemanalLabirinto_();
      // Se virou de sexta para sábado ou de domingo para segunda, regenera o cache na hora
      if (!dadosCache.semanaLabirinto || dadosCache.semanaLabirinto.chaveCiclo !== cicloAtual.chaveCiclo) {
        json = null;
      }
    } catch (err) {
      json = null;
    }
  }
  if (!json) {
    json = gerarECachearDadosPublicos_();
  }
  return responderTextoJSON_(json);
}
function gerarECachearDadosPublicos_() {
  var dados = montarDadosPublicos_();
  dados.geradoEm = Date.now(); // usado para preservar a validade do cache ao atualizá-lo
  var json = JSON.stringify(dados);
  try {
    CacheService.getScriptCache().put(CONFIG_API.CHAVE_CACHE, json, CONFIG_API.CACHE_SEGUNDOS);
  } catch (err) {
    // Acima de 100KB o cache recusa; segue sem cache
    console.warn("Não foi possível gravar o cache: " + err);
  }
  return json;
}
// Nunca incluir dados sensíveis (ex.: PIN) nesta resposta
function montarDadosPublicos_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var clientes = extrairDados(ss, "Clientes");
  var vendas = extrairDados(ss, "Vendas");
  var itens = extrairDados(ss, "Itens_vendas");
  var sabores = extrairDados(ss, "Sabores");
  var resultadosLabirinto = extrairDados(ss, "Resultados_Labirinto");
  var dataAtual = new Date();
  var mesAtual = dataAtual.getMonth();
  var anoAtual = dataAtual.getFullYear();
  var mapaSabores = {};
  sabores.forEach(function (s) {
    mapaSabores[s.ID_sabor] = s.Sabor;
  });
  var vendasCoren = {};
  vendas.forEach(function (v) {
    if (String(v.ID_local) === CONFIG_API.ID_LOCAL) {
      vendasCoren[v.ID_venda] = v;
    }
  });
  var ranking = {};
  var listaParaCombobox = [];
  clientes.forEach(function (c) {
    ranking[c.ID_cliente] = { nome: c.Nome, totalGeral: 0, totalMes: 0 };
    listaParaCombobox.push({ id: c.ID_cliente, nome: c.Nome });
  });
  var contagemSabores = {};
  itens.forEach(function (item) {
    var vendaInfo = vendasCoren[item.ID_venda];
    if (!vendaInfo) return;
    var idCliente = vendaInfo.ID_cliente;
    var dataVenda = new Date(vendaInfo.Data_venda);
    var qtd = parseInt(item.Quantidade, 10) || 0;
    if (ranking[idCliente]) {
      ranking[idCliente].totalGeral += qtd;
      if (dataVenda.getMonth() === mesAtual && dataVenda.getFullYear() === anoAtual) {
        ranking[idCliente].totalMes += qtd;
      }
    }
    var nomeSabor = mapaSabores[item.ID_sabor] || "Desconhecido";
    if (!contagemSabores[nomeSabor]) contagemSabores[nomeSabor] = 0;
    contagemSabores[nomeSabor] += qtd;
  });
  var rankingFinal = [];
  for (var chave in ranking) {
    if (ranking[chave].totalGeral > 0) rankingFinal.push(ranking[chave]);
  }
  var cicloLabirinto = obterCicloSemanalLabirinto_();
  return {
    ranking: rankingFinal,
    sabores: contagemSabores,
    clientes: listaParaCombobox,
    rankingLabirinto: calcularRankingLabirinto_(resultadosLabirinto, cicloLabirinto),
    semanaLabirinto: cicloLabirinto
  };
}
/**
 * Calcula o ciclo semanal atual do labirinto no fuso America/Recife (UTC-3).
 * - Segunda a Sexta (diaISO 1..5): competição aberta; ranking mostra resultados de Seg 00:00 a Sex 23:59:59.
 * - Sábado e Domingo (diaISO 6..7): competição encerrada; ranking exibe o resultado final da semana (Seg a Sex).
 * - Virada de Domingo para Segunda (00:00): novo ciclo inicia automaticamente e o ranking zera.
 */
function obterCicloSemanalLabirinto_(dataRef) {
  var agoraMs = dataRef instanceof Date ? dataRef.getTime() : Date.now();
  var offsetMs = CONFIG_API.FUSO_OFFSET_MS;
  var dataLocal = new Date(agoraMs + offsetMs);

  var diaSemana = dataLocal.getUTCDay(); // 0 = Dom, 1 = Seg, ..., 6 = Sáb
  var diaISO = diaSemana === 0 ? 7 : diaSemana; // 1 = Seg ... 7 = Dom
  var diasDesdeSegunda = diaISO - 1;

  var inicioHojeLocalMs = Date.UTC(
    dataLocal.getUTCFullYear(),
    dataLocal.getUTCMonth(),
    dataLocal.getUTCDate(),
    0, 0, 0, 0
  );
  var inicioSegundaLocalMs = inicioHojeLocalMs - (diasDesdeSegunda * 86400000);
  var fimSextaLocalMs = inicioSegundaLocalMs + (5 * 86400000) - 1;

  var inicioSemanaMs = inicioSegundaLocalMs - offsetMs;
  var fimSextaMs = fimSextaLocalMs - offsetMs;
  var competicaoAtiva = diaISO >= 1 && diaISO <= 5;

  var inicioFormatado = Utilities.formatDate(new Date(inicioSemanaMs), CONFIG_API.FUSO, "dd/MM");
  var fimFormatado = Utilities.formatDate(new Date(fimSextaMs), CONFIG_API.FUSO, "dd/MM");
  var chaveSegunda = Utilities.formatDate(new Date(inicioSemanaMs), CONFIG_API.FUSO, "yyyy-MM-dd");

  return {
    competicaoAtiva: competicaoAtiva,
    ehFimDeSemana: !competicaoAtiva,
    diaISO: diaISO,
    inicioSemanaMs: inicioSemanaMs,
    fimSextaMs: fimSextaMs,
    inicioFormatado: inicioFormatado,
    fimFormatado: fimFormatado,
    chaveCiclo: chaveSegunda + "_" + (competicaoAtiva ? "ativa" : "encerrada")
  };
}
function converterDataMs_(valor) {
  if (!valor) return NaN;
  if (valor instanceof Date) return valor.getTime();
  var texto = String(valor).trim();
  // Suporte a strings em formato brasileiro dd/MM/yyyy (com ou sem hora)
  var m = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (m) {
    var utcLocal = Date.UTC(
      parseInt(m[3], 10),
      parseInt(m[2], 10) - 1,
      parseInt(m[1], 10),
      parseInt(m[4] || "0", 10),
      parseInt(m[5] || "0", 10),
      parseInt(m[6] || "0", 10)
    );
    return utcLocal - CONFIG_API.FUSO_OFFSET_MS;
  }
  var d = new Date(texto);
  return d.getTime();
}
function registroNaSemanaAtual_(dataValor, ciclo) {
  var ts = converterDataMs_(dataValor);
  if (isNaN(ts)) return false;
  return ts >= ciclo.inicioSemanaMs && ts <= ciclo.fimSextaMs;
}
// Top 10 do labirinto na semana atual (Segunda a Sexta, melhor tempo por cliente, sem partidas pendentes)
function calcularRankingLabirinto_(resultadosLabirinto, ciclo) {
  var cicloAtual = ciclo || obterCicloSemanalLabirinto_();
  var melhorPorCliente = {};
  resultadosLabirinto.forEach(function (r) {
    var id = String(r.ID_cliente || r.ID_Cliente || "");
    var tempo = parseFloat(r.Tempo);
    if (!id || !(tempo > 0) || tempo >= CONFIG_API.TEMPO_PENDENTE) return;
    if (!registroNaSemanaAtual_(r.Data, cicloAtual)) return;
    if (!melhorPorCliente[id] || tempo < melhorPorCliente[id].Tempo) {
      melhorPorCliente[id] = { ID_Cliente: id, Data: r.Data, Tempo: tempo };
    }
  });
  return ordenarTop10_(Object.keys(melhorPorCliente).map(function (k) { return melhorPorCliente[k]; }));
}
function ordenarTop10_(lista) {
  return lista
    .sort(function (a, b) { return a.Tempo - b.Tempo; })
    .slice(0, 10);
}
// MOTOR DE ESCRITA (Recebe e valida o jogo)
function doPost(e) {
  try {
    var corpo = (e && e.postData && e.postData.contents) || "{}";
    var dadosRequest = JSON.parse(corpo);
    var acao = String(dadosRequest.acao || "");
    var idCliente = String(dadosRequest.idCliente || "").trim();
    if (!idCliente || idCliente.length > 50) {
      return responderJSON({ sucesso: false, erro: "Cliente inválido." });
    }
    if (acao === "validar_acesso") {
      return validarAcesso_(idCliente, String(dadosRequest.pin || "").trim());
    }
    if (acao === "salvar_tempo") {
      return salvarTempo_(idCliente, String(dadosRequest.idPartida || ""), dadosRequest.tempo);
    }
    return responderJSON({ sucesso: false, erro: "Ação inválida." });
  } catch (erro) {
    // Detalhe técnico só no log, nunca na resposta pública
    console.error("Erro no doPost: " + (erro && erro.stack ? erro.stack : erro));
    return responderJSON({ sucesso: false, erro: "Erro no servidor. Tente novamente." });
  }
}
// AÇÃO 1: Validar PIN e registrar a partida como pendente (9999)
function validarAcesso_(idCliente, pinFornecido) {
  var ciclo = obterCicloSemanalLabirinto_();
  if (!ciclo.competicaoAtiva) {
    return responderJSON({
      sucesso: false,
      erro: "A competição do labirinto funciona de segunda a sexta. No fim de semana exibimos o resultado da semana — volte na segunda-feira!"
    });
  }
  var cache = CacheService.getScriptCache();
  // Proteção contra força bruta do PIN
  var chaveFalhas = "pin_falhas_" + idCliente;
  var falhas = parseInt(cache.get(chaveFalhas), 10) || 0;
  if (falhas >= CONFIG_API.MAX_TENTATIVAS_PIN) {
    return responderJSON({
      sucesso: false,
      erro: "Muitas tentativas incorretas. Aguarde 15 minutos e tente novamente."
    });
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var clienteValido = false;
  if (pinFornecido && pinFornecido.length <= 20) {
    var clientes = extrairDados(ss, "Clientes");
    for (var i = 0; i < clientes.length; i++) {
      var pinPlanilha = String(clientes[i].PIN);
      if (String(clientes[i].ID_cliente) === idCliente && pinPlanilha !== "" && pinPlanilha === pinFornecido) {
        clienteValido = true;
        break;
      }
    }
  }
  if (!clienteValido) {
    cache.put(chaveFalhas, String(falhas + 1), CONFIG_API.BLOQUEIO_PIN_SEGUNDOS);
    return responderJSON({ sucesso: false, erro: "PIN incorreto. Tente novamente." });
  }
  cache.remove(chaveFalhas);
  // Impede que requisições simultâneas liberem duas partidas no mesmo dia
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    return responderJSON({ sucesso: false, erro: "Servidor ocupado. Tente novamente em instantes." });
  }
  try {
    var abaLabirinto = ss.getSheetByName("Resultados_Labirinto");
    var dadosLabirinto = lerAba_(abaLabirinto);
    var dataStringHoje = Utilities.formatDate(new Date(), CONFIG_API.FUSO, "dd/MM/yyyy");
    for (var j = 0; j < dadosLabirinto.length; j++) {
      var registro = dadosLabirinto[j];
      if (String(registro.ID_Cliente || registro.ID_cliente) !== idCliente) continue;
      var tsRegistro = converterDataMs_(registro.Data);
      if (isNaN(tsRegistro)) continue;
      if (Utilities.formatDate(new Date(tsRegistro), CONFIG_API.FUSO, "dd/MM/yyyy") === dataStringHoje) {
        var msgTentativa = ciclo.diaISO === 5
          ? "Você já usou a sua tentativa de hoje. No fim de semana exibimos o resultado final e na segunda começa uma nova disputa!"
          : "Você já usou a sua tentativa de hoje. Volte amanhã para jogar!";
        return responderJSON({
          sucesso: false,
          erro: msgTentativa
        });
      }
    }
    var idPartida = "LAB-" + Utilities.getUuid().substring(0, 8).toUpperCase();
    var agora = new Date();
    abaLabirinto.appendRow([idPartida, agora, idCliente, CONFIG_API.TEMPO_PENDENTE]);
    SpreadsheetApp.flush();
    cache.put("partida_" + idPartida, JSON.stringify({ c: idCliente, t: agora.getTime() }), 21600);
    return responderJSON({ sucesso: true, mensagem: "Acesso liberado!", idPartida: idPartida });
  } finally {
    lock.releaseLock();
  }
}
// AÇÃO 2: Salvar o tempo da partida (de 9999 para o tempo real)
function salvarTempo_(idCliente, idPartida, tempoBruto) {
  if (!idPartida) {
    return responderJSON({ sucesso: false, erro: "ID da partida não fornecido." });
  }
  if (!/^LAB-[0-9A-F]{8}$/.test(idPartida)) {
    return responderJSON({ sucesso: false, erro: "ID da partida inválido." });
  }
  var tempo = Number(tempoBruto);
  if (!isFinite(tempo) || tempo !== Math.floor(tempo) ||
      tempo < CONFIG_API.TEMPO_MINIMO || tempo > CONFIG_API.DURACAO_JOGO) {
    return responderJSON({ sucesso: false, erro: "Tempo inválido." });
  }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    return responderJSON({ sucesso: false, erro: "Servidor ocupado. Tente novamente em instantes." });
  }
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var abaLabirinto = ss.getSheetByName("Resultados_Labirinto");
    var celula = abaLabirinto.getRange("A:A")
      .createTextFinder(idPartida)
      .matchEntireCell(true)
      .findNext();
    if (!celula) {
      return responderJSON({ sucesso: false, erro: "Partida não encontrada." });
    }
    var linha = celula.getRow();
    var valores = abaLabirinto.getRange(linha, 1, 1, 4).getValues()[0]; // [ID, Data, Cliente, Tempo]
    if (String(valores[2]) !== idCliente) {
      return responderJSON({ sucesso: false, erro: "Partida não pertence a este cliente." });
    }
    var tempoGravado = Number(valores[3]);
    // Reenvio do mesmo resultado (ex.: a resposta anterior se perdeu na rede):
    // responde sucesso sem gravar de novo, para o site poder repetir com segurança
    if (tempoGravado === tempo) {
      return responderJSON({
        sucesso: true,
        mensagem: "Resultado salvo com sucesso!",
        rankingLabirinto: obterRankingLabirintoAtual_(ss)
      });
    }
    if (tempoGravado !== CONFIG_API.TEMPO_PENDENTE) {
      return responderJSON({ sucesso: false, erro: "O resultado desta partida já foi registrado." });
    }
    // O tempo enviado precisa ser coerente com o relógio do servidor
    var cache = CacheService.getScriptCache();
    var inicioMs = null;
    var infoPartida = cache.get("partida_" + idPartida);
    if (infoPartida) {
      inicioMs = JSON.parse(infoPartida).t;
    } else if (valores[1] instanceof Date) {
      inicioMs = valores[1].getTime();
    }
    if (inicioMs) {
      var decorrido = (Date.now() - inicioMs) / 1000;
      var tempoMaximo = decorrido - CONFIG_API.CONTAGEM_REGRESSIVA + 1;
      var tempoMinimo = decorrido - CONFIG_API.CONTAGEM_REGRESSIVA - CONFIG_API.FOLGA_REDE;
      if (decorrido > CONFIG_API.PRAZO_MAX_SALVAR) {
        return responderJSON({ sucesso: false, erro: "O prazo para registrar esta partida expirou." });
      }
      if (tempo > tempoMaximo || tempo < tempoMinimo) {
        return responderJSON({ sucesso: false, erro: "Resultado inconsistente com o tempo da partida." });
      }
    }
    abaLabirinto.getRange(linha, 4).setValue(tempo);
    SpreadsheetApp.flush();
    cache.remove("partida_" + idPartida);
    // Em vez de apagar o cache do site (o que obrigava o próximo GET a reler
    // todas as abas), atualiza só o ranking do labirinto dentro dele
    var rankingLabirinto = atualizarRankingLabirintoNoCache_(ss, idCliente, tempo, valores[1]);
    return responderJSON({
      sucesso: true,
      mensagem: "Resultado salvo com sucesso!",
      rankingLabirinto: rankingLabirinto
    });
  } finally {
    lock.releaseLock();
  }
}
// CACHE
function limparCache() {
  CacheService.getScriptCache().remove(CONFIG_API.CHAVE_CACHE);
}
// Lê o cache público já parseado (ou null)
function lerCachePublico_() {
  var json = CacheService.getScriptCache().get(CONFIG_API.CHAVE_CACHE);
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}
// Ranking atual: do cache, se existir; senão, lê só a aba do labirinto
function obterRankingLabirintoAtual_(ss) {
  var ciclo = obterCicloSemanalLabirinto_();
  var dados = lerCachePublico_();
  if (dados && Array.isArray(dados.rankingLabirinto)) {
    return dados.rankingLabirinto.filter(function (item) {
      return registroNaSemanaAtual_(item.Data, ciclo);
    });
  }
  return calcularRankingLabirinto_(extrairDados(ss, "Resultados_Labirinto"), ciclo);
}
/**
 * Insere o novo tempo no ranking guardado no cache, sem reler a planilha.
 * O novo Top 10 é sempre subconjunto de (Top 10 antigo + novo resultado),
 * então o resultado é idêntico ao recálculo completo.
 * Preserva a validade original do cache para não "congelar" os demais dados.
 */
function atualizarRankingLabirintoNoCache_(ss, idCliente, tempo, data) {
  var ciclo = obterCicloSemanalLabirinto_();
  var dados = lerCachePublico_();
  if (!dados || !Array.isArray(dados.rankingLabirinto)) {
    // Sem cache: calcula só o ranking (1 aba); o próximo GET/aquecimento recria o cache
    return calcularRankingLabirinto_(extrairDados(ss, "Resultados_Labirinto"), ciclo);
  }
  var lista = dados.rankingLabirinto.filter(function (item) {
    return registroNaSemanaAtual_(item.Data, ciclo);
  });
  if (registroNaSemanaAtual_(data, ciclo)) {
    var existente = null;
    for (var i = 0; i < lista.length; i++) {
      if (String(lista[i].ID_Cliente) === String(idCliente)) {
        existente = lista[i];
        break;
      }
    }
    if (existente) {
      if (tempo < Number(existente.Tempo)) {
        existente.Tempo = tempo;
        existente.Data = data;
      }
    } else {
      lista.push({ ID_Cliente: String(idCliente), Data: data, Tempo: tempo });
    }
  }
  lista = ordenarTop10_(lista);
  dados.rankingLabirinto = lista;
  dados.semanaLabirinto = ciclo;
  var restante = CONFIG_API.CACHE_SEGUNDOS;
  if (dados.geradoEm) {
    restante = Math.floor(CONFIG_API.CACHE_SEGUNDOS - (Date.now() - dados.geradoEm) / 1000);
  }
  try {
    if (restante >= 5) {
      CacheService.getScriptCache().put(CONFIG_API.CHAVE_CACHE, JSON.stringify(dados), restante);
    } else {
      limparCache(); // cache quase expirando: deixa o próximo GET recriar
    }
  } catch (err) {
    console.warn("Não foi possível atualizar o cache: " + err);
    limparCache();
  }
  return lista;
}
// Qualquer edição manual na planilha limpa o cache (se já existir outro onEdit, junte os dois)
function onEdit(e) {
  limparCache();
}
// Usar com acionador baseado no tempo (a cada 5 minutos)
function aquecerCache() {
  gerarECachearDadosPublicos_();
}
// FUNÇÕES AUXILIARES (Apoio)
function extrairDados(ss, nomeAba) {
  return lerAba_(ss.getSheetByName(nomeAba));
}
function lerAba_(aba) {
  if (!aba) return [];
  var dados = aba.getDataRange().getValues();
  if (dados.length < 2) return [];
  var cabecalhos = dados[0];
  var resultado = [];
  for (var i = 1; i < dados.length; i++) {
    var linha = dados[i];
    var vazia = true;
    for (var v = 0; v < linha.length; v++) {
      if (linha[v] !== "" && linha[v] !== null) { vazia = false; break; }
    }
    if (vazia) continue;
    var obj = {};
    for (var j = 0; j < cabecalhos.length; j++) {
      obj[cabecalhos[j]] = linha[j];
    }
    resultado.push(obj);
  }
  return resultado;
}
function responderJSON(objeto) {
  return responderTextoJSON_(JSON.stringify(objeto));
}
function responderTextoJSON_(texto) {
  return ContentService.createTextOutput(texto)
    .setMimeType(ContentService.MimeType.JSON);
}
