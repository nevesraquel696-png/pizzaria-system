# Envia bytes ESC/POS "crus" direto pro spooler do Windows (sem janela de
# impressão, sem driver gráfico no meio). Uso:
#   powershell -File imprimir-raw.ps1 -Impressora "MTI-773" -Arquivo comanda.bin
param(
    [Parameter(Mandatory=$true)][string]$Impressora,
    [Parameter(Mandatory=$true)][string]$Arquivo
)

$codigo = @"
using System;
using System.Runtime.InteropServices;

public class ImpressaoRaw {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

    public static string Enviar(string impressora, byte[] bytes) {
        IntPtr hPrinter;
        if (!OpenPrinter(impressora, out hPrinter, IntPtr.Zero))
            return "Nao foi possivel abrir a impressora '" + impressora + "'. Confira o nome no Windows (erro " + Marshal.GetLastWin32Error() + ").";

        DOCINFOA di = new DOCINFOA();
        di.pDocName = "Comanda Pizzaria";
        di.pDataType = "RAW";

        string erro = null;
        if (StartDocPrinter(hPrinter, 1, di)) {
            if (StartPagePrinter(hPrinter)) {
                IntPtr ptr = Marshal.AllocCoTaskMem(bytes.Length);
                Marshal.Copy(bytes, 0, ptr, bytes.Length);
                int escritos;
                if (!WritePrinter(hPrinter, ptr, bytes.Length, out escritos))
                    erro = "Falha ao enviar dados para a impressora (erro " + Marshal.GetLastWin32Error() + ").";
                Marshal.FreeCoTaskMem(ptr);
                EndPagePrinter(hPrinter);
            } else {
                erro = "Falha ao iniciar a pagina (erro " + Marshal.GetLastWin32Error() + ").";
            }
            EndDocPrinter(hPrinter);
        } else {
            erro = "Falha ao iniciar o documento (erro " + Marshal.GetLastWin32Error() + ").";
        }
        ClosePrinter(hPrinter);
        return erro;
    }
}
"@

Add-Type -TypeDefinition $codigo
$bytes = [System.IO.File]::ReadAllBytes($Arquivo)
$resultado = [ImpressaoRaw]::Enviar($Impressora, $bytes)
if ($resultado) {
    Write-Error $resultado
    exit 1
}
