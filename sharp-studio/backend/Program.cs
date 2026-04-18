using System.ComponentModel;
using System.Diagnostics;

var builder = WebApplication.CreateBuilder(args);

var app = builder.Build();

var contentRoot = app.Environment.ContentRootPath;
var workRoot = Path.Combine(contentRoot, "work");
var inputRoot = Path.Combine(workRoot, "inputs");
var outputRoot = Path.Combine(workRoot, "outputs");
var modelRoot = Path.Combine(contentRoot, "wwwroot", "models");

Directory.CreateDirectory(inputRoot);
Directory.CreateDirectory(outputRoot);
Directory.CreateDirectory(modelRoot);

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapPost("/api/reconstruct", async (IFormFile image, CancellationToken cancellationToken) =>
{
    if (image.Length == 0)
    {
        return Results.BadRequest(new { error = "No image uploaded." });
    }

    var extension = Path.GetExtension(image.FileName);
    if (string.IsNullOrWhiteSpace(extension))
    {
        extension = ".png";
    }

    var requestId = Guid.NewGuid().ToString("N");
    var requestInputDir = Path.Combine(inputRoot, requestId);
    var requestOutputDir = Path.Combine(outputRoot, requestId);
    Directory.CreateDirectory(requestInputDir);
    Directory.CreateDirectory(requestOutputDir);

    var safeExtension = extension.Replace("..", string.Empty, StringComparison.Ordinal);
    var inputPath = Path.Combine(requestInputDir, $"input{safeExtension}");

    await using (var stream = File.Create(inputPath))
    {
        await image.CopyToAsync(stream, cancellationToken);
    }

    var processStartInfo = new ProcessStartInfo
    {
        FileName = "sharp",
        RedirectStandardError = true,
        RedirectStandardOutput = true,
        UseShellExecute = false,
        CreateNoWindow = true
    };

    processStartInfo.ArgumentList.Add("predict");
    processStartInfo.ArgumentList.Add("-i");
    processStartInfo.ArgumentList.Add(requestInputDir);
    processStartInfo.ArgumentList.Add("-o");
    processStartInfo.ArgumentList.Add(requestOutputDir);

    try
    {
        using var process = new Process { StartInfo = processStartInfo };
        process.Start();

        var stdOutTask = process.StandardOutput.ReadToEndAsync(cancellationToken);
        var stdErrTask = process.StandardError.ReadToEndAsync(cancellationToken);

        await process.WaitForExitAsync(cancellationToken);

        var stdOut = await stdOutTask;
        var stdErr = await stdErrTask;

        if (process.ExitCode != 0)
        {
            return Results.Problem(
                title: "SHARP reconstruction failed",
                detail: $"Exit code: {process.ExitCode}\n{stdErr}\n{stdOut}",
                statusCode: StatusCodes.Status500InternalServerError);
        }
    }
    catch (Win32Exception ex)
    {
        return Results.Problem(
            title: "SHARP CLI not found",
            detail: $"Could not execute 'sharp'. Ensure Apple ml-sharp is installed and available on PATH. {ex.Message}",
            statusCode: StatusCodes.Status500InternalServerError);
    }

    var plyPath = Directory
        .EnumerateFiles(requestOutputDir, "*.ply", SearchOption.AllDirectories)
        .FirstOrDefault();

    if (plyPath is null)
    {
        return Results.Problem(
            title: "No PLY output found",
            detail: "The SHARP process completed but did not produce a .ply file.",
            statusCode: StatusCodes.Status500InternalServerError);
    }

    var latestPath = Path.Combine(modelRoot, "latest.ply");
    File.Copy(plyPath, latestPath, overwrite: true);

    var version = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    return Results.Json(new
    {
        modelUrl = $"/models/latest.ply?v={version}",
        generatedAt = version
    });
}).DisableAntiforgery();

app.MapGet("/api/latest", () =>
{
    var latestPath = Path.Combine(modelRoot, "latest.ply");
    if (!File.Exists(latestPath))
    {
        return Results.NotFound(new { error = "No generated model found yet." });
    }

    var generatedAt = new DateTimeOffset(File.GetLastWriteTimeUtc(latestPath)).ToUnixTimeMilliseconds();
    return Results.Json(new
    {
        modelUrl = $"/models/latest.ply?v={generatedAt}",
        generatedAt
    });
});

app.MapGet("/health", () => Results.Json(new { status = "ok" }));

app.Run();
